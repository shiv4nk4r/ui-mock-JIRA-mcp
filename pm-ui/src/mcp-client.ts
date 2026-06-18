/**
 * MCP HTTP client — connects pm-ui to the standalone pm-mcp server.
 *
 * Skills (visual mockup templates, prompt engineering) live in pm-ui only.
 * Context docs, design language, sitemap, and code-graph tools come from pm-mcp.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_MCP_URL = "http://127.0.0.1:3100/mcp";

/** Must match the server name in poc-mcp/.mcp.json */
export const MCP_SERVER_NAME = "manager-dashboard";

export function getMcpServerUrl(): string {
  return process.env.MCP_SERVER_URL ?? DEFAULT_MCP_URL;
}

export function getMcpHealthUrl(): string {
  return getMcpServerUrl().replace(/\/mcp\/?$/, "/health");
}

/** Inline MCP config for `claude --mcp-config` when spawning a child process. */
export function buildClaudeMcpConfig(): { mcpServers: Record<string, { type: string; url: string }> } {
  return {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: "http",
        url: getMcpServerUrl(),
      },
    },
  };
}

/** JSON string argument for `claude --mcp-config`. */
export function claudeMcpConfigArg(): string {
  return JSON.stringify(buildClaudeMcpConfig());
}

/** Wildcard pattern for `--allowedTools` covering all pm-mcp tools. */
export function claudeMcpAllowedToolsPattern(): string {
  return `mcp__${MCP_SERVER_NAME}__*`;
}

export async function checkMcpServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(getMcpHealthUrl(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

export interface McpClientHandle {
  client: Client;
  close: () => Promise<void>;
}

export async function createMcpClient(): Promise<McpClientHandle> {
  const transport = new StreamableHTTPClientTransport(new URL(getMcpServerUrl()));
  const client = new Client(
    { name: "pm-ui-chat", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);
  return { client, close: () => client.close() };
}

export interface FetchedContext {
  architecture: string;
  design: string;
  sitemap: string;
}

export async function fetchContextResources(): Promise<FetchedContext> {
  const { client, close } = await createMcpClient();
  try {
    const [archRes, designRes, sitemapRes] = await Promise.all([
      client.readResource({ uri: "resource://docs/architecture" }),
      client.readResource({ uri: "resource://docs/design" }),
      client.readResource({ uri: "resource://docs/sitemap" }),
    ]);
    const txt = (r: { contents: unknown[] }) =>
      ((r.contents[0] as Record<string, unknown>)?.text as string) ?? "";
    return { architecture: txt(archRes), design: txt(designRes), sitemap: txt(sitemapRes) };
  } finally {
    await close();
  }
}

function toolText(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}

/** Official icons/logos catalog from mdui/public/ in the repo checkout. */
export async function fetchBrandIconCatalog(query?: string): Promise<string> {
  const { client, close } = await createMcpClient();
  try {
    const result = await client.callTool({
      name: "list-brand-icons",
      arguments: query ? { query } : {},
    });
    return toolText(result);
  } catch {
    return "";
  } finally {
    await close();
  }
}

/** Existing reusable Vue components (components/ + pages/) for grounding. */
export async function fetchComponentCatalog(query?: string, limit = 60): Promise<string> {
  const { client, close } = await createMcpClient();
  try {
    const result = await client.callTool({
      name: "list-reusable-components",
      arguments: { ...(query ? { query } : {}), scope: "both", limit },
    });
    return toolText(result);
  } catch {
    return "";
  } finally {
    await close();
  }
}

/** Real rendered pages captured from the live app by the crawler. */
export async function fetchCapturedPageCatalog(): Promise<string> {
  const { client, close } = await createMcpClient();
  try {
    const result = await client.callTool({
      name: "list-captured-pages",
      arguments: {},
    });
    return toolText(result);
  } catch {
    return "";
  } finally {
    await close();
  }
}

/** Real rendered component/modal snapshots captured from the live app. */
export async function fetchRenderedComponentCatalog(query?: string): Promise<string> {
  const { client, close } = await createMcpClient();
  try {
    const result = await client.callTool({
      name: "list-rendered-components",
      arguments: query ? { query } : {},
    });
    return toolText(result);
  } catch {
    return "";
  } finally {
    await close();
  }
}

export interface UiReferenceValidation {
  valid: boolean;
  unknownComponents: Array<{ ref: string; suggestions?: string[] }>;
  unknownIcons: Array<{ ref: string; suggestions?: string[] }>;
}

/** Verify reused components/icons exist in the codebase (hard-fail grounding). */
export async function validateUiReferences(refs: {
  components?: string[];
  icons?: string[];
}): Promise<UiReferenceValidation> {
  const { client, close } = await createMcpClient();
  try {
    const result = await client.callTool({
      name: "validate-ui-references",
      arguments: {
        components: refs.components ?? [],
        icons: refs.icons ?? [],
      },
    });
    const text = toolText(result);
    const jsonEnd = text.indexOf("\n\n");
    const jsonStr = jsonEnd >= 0 ? text.slice(0, jsonEnd) : text;
    const parsed = JSON.parse(jsonStr) as UiReferenceValidation;
    return parsed;
  } catch {
    // If validation is unavailable, do not block generation.
    return { valid: true, unknownComponents: [], unknownIcons: [] };
  } finally {
    await close();
  }
}

export async function listProductScreenshots(): Promise<string[]> {
  const { client, close } = await createMcpClient();
  try {
    const result = await client.callTool({ name: "list-product-screenshots", arguments: {} });
    const text = (result.content as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    if (!text || text.includes("No product screenshots")) return [];
    return text
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  } finally {
    await close();
  }
}

export function screenshotPath(filename: string): string {
  return filename;
}

export type GeminiSchema = Record<string, unknown>;

export function mcpSchemaToGemini(jsonSchema: Record<string, unknown>): GeminiSchema {
  const TYPE_MAP: Record<string, string> = {
    string: "STRING",
    number: "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array: "ARRAY",
    object: "OBJECT",
  };

  const result: GeminiSchema = {
    type: TYPE_MAP[(jsonSchema.type as string) ?? "string"] ?? "STRING",
  };

  if (jsonSchema.description) result.description = jsonSchema.description;
  if (jsonSchema.enum) result.enum = jsonSchema.enum;

  if (jsonSchema.properties && typeof jsonSchema.properties === "object") {
    result.properties = Object.fromEntries(
      Object.entries(jsonSchema.properties as Record<string, unknown>).map(([k, v]) => [
        k,
        mcpSchemaToGemini(v as Record<string, unknown>),
      ])
    );
  }

  if (jsonSchema.required) result.required = jsonSchema.required;
  if (jsonSchema.items) {
    result.items = mcpSchemaToGemini(jsonSchema.items as Record<string, unknown>);
  }

  return result;
}

export async function listMcpToolsAsGeminiDeclarations(
  client: Client
): Promise<GeminiSchema[]> {
  const { tools } = await client.listTools();
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    parameters: mcpSchemaToGemini(tool.inputSchema as Record<string, unknown>),
  }));
}
