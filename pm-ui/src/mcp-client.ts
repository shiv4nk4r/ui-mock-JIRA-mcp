/**
 * MCP HTTP client — connects pm-ui to the standalone pm-mcp server.
 *
 * Skills (visual mockup templates, prompt engineering) live in pm-ui only.
 * Context docs, design language, sitemap, and code-graph tools come from pm-mcp.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_MCP_URL = "http://127.0.0.1:3100/mcp";

function getMcpServerUrl(): string {
  return process.env.MCP_SERVER_URL ?? DEFAULT_MCP_URL;
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
