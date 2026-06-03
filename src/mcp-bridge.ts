/**
 * MCP Bridge — InMemoryTransport-based MCP client for the chat pipeline.
 *
 * How the context actually flows to AI providers today vs. how it should:
 *
 * ❌ BEFORE (this file didn't exist):
 *   Chat route → fs.readFileSync() → raw strings → injected into system prompt
 *   MCP server (/api/mcp) was a completely separate endpoint for Claude Desktop / Cursor IDE only.
 *
 * ✅ AFTER (this bridge):
 *   Chat route → MCP Client (InMemoryTransport) → MCP Server → resources & tools
 *   The MCP protocol is respected. The chat route is now a proper MCP client.
 *   For Gemini: MCP tools are mapped to Gemini FunctionDeclarations so Gemini
 *   can call them dynamically in an agentic loop (no pre-baked prompt injection needed).
 *
 * InMemoryTransport means no HTTP round-trips — both client and server live in the
 * same Node.js process, communicating through an in-memory message queue.
 */

import { Client }            from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer }         from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }                 from "zod";
import fs                    from "fs";
import path                  from "path";

// ── Context file loader ───────────────────────────────────────────────────────

const CONTEXT_DIR = path.join(process.cwd(), "src", "mcp-context");

function loadCtx(filename: string): string {
  return fs.readFileSync(path.join(CONTEXT_DIR, filename), "utf-8");
}

export function listProductScreenshots(): string[] {
  try {
    return fs
      .readdirSync(CONTEXT_DIR)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

export function screenshotPath(filename: string): string {
  return path.join(CONTEXT_DIR, filename);
}

function extractSection(content: string, heading: string): string {
  const startIdx = content.indexOf(heading);
  if (startIdx === -1) return `⚠ Section "${heading}" not found.`;
  const afterStart = content.slice(startIdx + heading.length);
  const nextIdx    = afterStart.search(/\n## /);
  return nextIdx === -1
    ? content.slice(startIdx)
    : content.slice(startIdx, startIdx + heading.length + nextIdx);
}

// ── Section indexes (kept in sync with the HTTP MCP route) ───────────────────

const ARCH_SECTIONS = {
  "overview":    "## 1. Monorepo Overview",
  "stack":       "## 2. Technology Stack",
  "architecture":"## 3. Architecture",
  "data-flow":   "## 4. Data Flow & Request Lifecycle",
  "auth":        "## 5. Authentication & Session Management",
  "frontend":    "## 6. Frontend (mdui/)",
  "backend":     "## 7. Backend BFF (mdbff/)",
  "services":    "## 9. External Services & Integrations",
  "conventions": "## 11. Coding Standards & Conventions",
  "state":       "## 12. State Management",
  "routing":     "## 13. Routing Structure",
  "deployment":  "## 15. Deployment & Infrastructure",
} as const;

const DESIGN_SECTIONS = {
  "colors":        "## 2. Color System",
  "typography":    "## 3. Typography",
  "layout":        "## 4. Layout & Page Structure",
  "buttons":       "## 9. Buttons",
  "inputs":        "## 10. Form Inputs",
  "tables":        "## 11. Data Tables",
  "chips-badges":  "## 14. Status Chips & Badges",
  "charts":        "## 15. Charts",
  "modals":        "## 16. Modals / Dialogs",
  "patterns":      "## 24. Patterns — What Agents MUST Follow",
  "anti-patterns": "## 25. Anti-Patterns — What Agents MUST NEVER Do",
  "quick-ref":     "## 26. Quick Reference Card for Agents",
} as const;

const SITEMAP_SECTIONS = {
  "global-ui":      "## Global Persistent UI",
  "outbound":       "### 2. OUTBOUND",
  "inventory":      "### 7. INVENTORY",
  "shift-planning": "### 10. SHIFT PLANNING",
  "feature-flags":  "## Feature Flags Summary",
  "quick-reference":"## Full Sitemap at a Glance",
} as const;

// ── MCP Server factory ────────────────────────────────────────────────────────
// Creates a fresh server instance each call to avoid shared-state issues
// between the HTTP route (SSE transport) and the chat bridge (InMemoryTransport).

function buildServer(): McpServer {
  const server = new McpServer({ name: "pm-context-bridge", version: "2.0.0" });

  // ── Resources ──────────────────────────────────────────────────────────────
  server.registerResource(
    "architecture-context",
    "resource://docs/architecture",
    { mimeType: "text/markdown", description: "Full system architecture, tech stack, data flow, conventions" },
    async () => ({ contents: [{ uri: "resource://docs/architecture", mimeType: "text/markdown", text: loadCtx("context.md") }] })
  );

  server.registerResource(
    "design-language",
    "resource://docs/design",
    { mimeType: "text/markdown", description: "Quasar Vue 2 design language: colors, components, patterns" },
    async () => ({ contents: [{ uri: "resource://docs/design", mimeType: "text/markdown", text: loadCtx("design.md") }] })
  );

  server.registerResource(
    "sitemap-context",
    "resource://docs/sitemap",
    { mimeType: "text/markdown", description: "Navigation sitemap: L1 tabs, sub-tabs, routes, feature flags" },
    async () => ({ contents: [{ uri: "resource://docs/sitemap", mimeType: "text/markdown", text: loadCtx("site-map.md") }] })
  );

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.tool(
    "list-product-screenshots",
    "Lists all product screenshot PNG files in the context directory. Read them with the Read tool to match the actual Manager Dashboard UI when generating mockups.",
    async () => {
      const files = listProductScreenshots();
      const lines = files.map((f) => `${path.join(CONTEXT_DIR, f)}`).join("\n");
      return {
        content: [{ type: "text", text: files.length
          ? `Available product screenshots (read these with the Read tool to match the actual UI):\n${lines}`
          : "No product screenshots found in context directory."
        }],
      };
    }
  );

  server.tool(
    "query-architecture",
    {
      section:  z.enum(Object.keys(ARCH_SECTIONS) as [string, ...string[]]).describe(`Architecture section. Options: ${Object.keys(ARCH_SECTIONS).join(", ")}`),
      question: z.string().optional().describe("Specific question about the section"),
    },
    async ({ section, question }) => {
      const content = extractSection(loadCtx("context.md"), ARCH_SECTIONS[section as keyof typeof ARCH_SECTIONS]);
      return { content: [{ type: "text", text: content }, ...(question ? [{ type: "text" as const, text: `\n**Question:** ${question}` }] : [])] };
    }
  );

  server.tool(
    "query-design-language",
    {
      section:   z.enum(Object.keys(DESIGN_SECTIONS) as [string, ...string[]]).describe(`Design section. Options: ${Object.keys(DESIGN_SECTIONS).join(", ")}`),
      component: z.string().optional().describe("Specific Quasar component to find"),
    },
    async ({ section, component }) => {
      const content = extractSection(loadCtx("design.md"), DESIGN_SECTIONS[section as keyof typeof DESIGN_SECTIONS]);
      return { content: [{ type: "text", text: content }, ...(component ? [{ type: "text" as const, text: `\n**Looking up:** ${component}` }] : [])] };
    }
  );

  server.tool(
    "query-sitemap",
    {
      section: z.enum(Object.keys(SITEMAP_SECTIONS) as [string, ...string[]]).describe(`Sitemap section. Options: ${Object.keys(SITEMAP_SECTIONS).join(", ")}`),
    },
    async ({ section }) => {
      const content = extractSection(loadCtx("site-map.md"), SITEMAP_SECTIONS[section as keyof typeof SITEMAP_SECTIONS]);
      return { content: [{ type: "text", text: content }] };
    }
  );

  return server;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface McpClientHandle {
  client: Client;
  close: () => Promise<void>;
}

/**
 * Creates a connected MCP client via InMemoryTransport.
 *
 * No network involved — both client and server communicate through an in-memory
 * message queue in the same process. This is the canonical way to use MCP
 * context in a server-side function without exposing an HTTP endpoint.
 *
 * Always call close() when done to release resources.
 */
export async function createMcpClient(): Promise<McpClientHandle> {
  const server = buildServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client(
    { name: "chat-bridge", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(clientTransport);

  return { client, close: () => client.close() };
}

export interface FetchedContext {
  architecture: string;
  design: string;
  sitemap: string;
}

/**
 * Fetches all three context resources via MCP (architecture, design, sitemap).
 *
 * Use this for providers that need context injected into a system prompt
 * (Claude, OpenAI). Gemini uses createMcpClient() directly so it can also
 * call tools via function-calling in an agentic loop.
 */
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

// ── Gemini tool schema conversion ─────────────────────────────────────────────

type GeminiSchema = Record<string, unknown>;

/**
 * Converts an MCP tool's JSON Schema (generated by Zod) into the schema object
 * expected by Gemini's FunctionDeclaration.parameters field.
 *
 * Gemini uses SchemaType enum strings ("STRING", "OBJECT", etc.) instead of
 * lowercase JSON Schema type names.
 */
export function mcpSchemaToGemini(jsonSchema: Record<string, unknown>): GeminiSchema {
  const TYPE_MAP: Record<string, string> = {
    string:  "STRING",
    number:  "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array:   "ARRAY",
    object:  "OBJECT",
  };

  const result: GeminiSchema = {
    type: TYPE_MAP[(jsonSchema.type as string) ?? "string"] ?? "STRING",
  };

  if (jsonSchema.description) result.description = jsonSchema.description;
  if (jsonSchema.enum)        result.enum = jsonSchema.enum;

  if (jsonSchema.properties && typeof jsonSchema.properties === "object") {
    result.properties = Object.fromEntries(
      Object.entries(jsonSchema.properties as Record<string, unknown>).map(
        ([k, v]) => [k, mcpSchemaToGemini(v as Record<string, unknown>)]
      )
    );
  }

  if (jsonSchema.required) result.required = jsonSchema.required;
  if (jsonSchema.items)    result.items = mcpSchemaToGemini(jsonSchema.items as Record<string, unknown>);

  return result;
}

/**
 * Lists all MCP tools and converts them to Gemini FunctionDeclaration objects.
 * Pass the result directly to Gemini's tools: [{ functionDeclarations }] field.
 */
export async function listMcpToolsAsGeminiDeclarations(
  client: Client
): Promise<GeminiSchema[]> {
  const { tools } = await client.listTools();
  return tools.map((tool) => ({
    name:        tool.name,
    description: tool.description ?? "",
    parameters:  mcpSchemaToGemini(tool.inputSchema as Record<string, unknown>),
  }));
}
