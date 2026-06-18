/**
 * Filesystem MCP tools — integrates @modelcontextprotocol/server-filesystem
 * into pm-mcp with path validation scoped to allowed directories.
 */

import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { minimatch } from "minimatch";

import {
  applyFileEdits,
  formatSize,
  getAllowedDirectories,
  getFileStats,
  headFile,
  readFileContent,
  searchFilesWithValidation,
  setAllowedDirectories,
  tailFile,
  validatePath,
  writeFileContent,
} from "@modelcontextprotocol/server-filesystem/dist/lib.js";
import { expandHome, normalizePath } from "@modelcontextprotocol/server-filesystem/dist/path-utils.js";

import { PM_MCP_ROOT } from "./paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONTEXT_DIR = path.join(__dirname, "context");

async function readFileAsBase64Stream(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
    stream.on("error", reject);
  });
}

/** Resolve and normalize allowed directory paths (follows symlinks when present). */
export async function resolveAllowedDirectories(directories: string[]): Promise<string[]> {
  const resolved = await Promise.all(
    directories.map(async (dir) => {
      const absolute = path.resolve(expandHome(dir));
      try {
        return normalizePath(await fs.realpath(absolute));
      } catch {
        return normalizePath(absolute);
      }
    })
  );
  return [...new Set(resolved)] as string[];
}

/** Build default allowed dirs: active checkout + all .repos worktrees + bundled context. */
export function defaultFilesystemDirs(repoRoot: string): string[] {
  const dirs = [repoRoot, CONTEXT_DIR];

  const reposDir = path.join(PM_MCP_ROOT, ".repos");
  if (fsSync.existsSync(reposDir)) {
    dirs.push(reposDir);
  }

  const extra = process.env.FS_ALLOWED_DIRS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (extra?.length) dirs.push(...extra);
  return dirs;
}

/** Initialize global allowed directories (call once at startup). */
export async function initFilesystemAccess(directories: string[]): Promise<string[]> {
  return updateFilesystemAccess(directories);
}

/** Refresh allowed directories (e.g. after branch switch). */
export async function updateFilesystemAccess(directories: string[]): Promise<string[]> {
  const resolved = await resolveAllowedDirectories(directories);

  await Promise.all(
    resolved.map(async (dir) => {
      const stats = await fs.stat(dir);
      if (!stats.isDirectory()) {
        throw new Error(`FS allowed path is not a directory: ${dir}`);
      }
    })
  );

  setAllowedDirectories(resolved);
  console.log(`[fs] Allowed directories (${resolved.length}):`);
  resolved.forEach((d) => console.log(`  • ${d}`));
  return resolved;
}

/** Register filesystem tools on an existing McpServer. Write tools are omitted when readOnly (default). */
export function registerFilesystemTools(
  server: McpServer,
  options: { readOnly?: boolean } = {}
): void {
  const readOnly = options.readOnly !== false;
  const readTextFileHandler = async (args: {
    path: string;
    tail?: number;
    head?: number;
  }) => {
    const validPath = await validatePath(args.path);
    if (args.head && args.tail) {
      throw new Error("Cannot specify both head and tail parameters simultaneously");
    }
    let content: string;
    if (args.tail) content = await tailFile(validPath, args.tail);
    else if (args.head) content = await headFile(validPath, args.head);
    else content = await readFileContent(validPath);
    return { content: [{ type: "text" as const, text: content }] };
  };

  server.tool(
    "read_text_file",
    {
      path: z.string().describe("Absolute or relative path within allowed directories"),
      tail: z.number().optional().describe("Return only the last N lines"),
      head: z.number().optional().describe("Return only the first N lines"),
    },
    readTextFileHandler
  );

  server.tool(
    "read_file",
    {
      path: z.string(),
      tail: z.number().optional(),
      head: z.number().optional(),
    },
    readTextFileHandler
  );

  server.tool(
    "read_media_file",
    "Read an image or audio file as base64 (within allowed directories).",
    { path: z.string().describe("Path to an image or audio file") },
    async ({ path: filePath }) => {
      const validPath = await validatePath(filePath);
      const ext = path.extname(validPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".svg": "image/svg+xml",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
      };
      const mimeType = mimeTypes[ext] ?? "application/octet-stream";
      const data = await readFileAsBase64Stream(validPath);
      if (mimeType.startsWith("image/")) {
        return { content: [{ type: "image" as const, data, mimeType }] };
      }
      if (mimeType.startsWith("audio/")) {
        return { content: [{ type: "audio" as const, data, mimeType }] };
      }
      return {
        content: [{ type: "text" as const, text: `[binary file base64]\nmimeType: ${mimeType}\ndata: ${data.slice(0, 200)}…` }],
      };
    }
  );

  server.tool(
    "read_multiple_files",
    {
      paths: z
        .array(z.string())
        .min(1)
        .describe("File paths to read (within allowed directories)"),
    },
    async ({ paths: filePaths }) => {
      const results = await Promise.all(
        filePaths.map(async (fp) => {
          try {
            const validPath = await validatePath(fp);
            const content = await readFileContent(validPath);
            return `${fp}:\n${content}\n`;
          } catch (e) {
            return `${fp}: Error - ${(e as Error).message}`;
          }
        })
      );
      return { content: [{ type: "text", text: results.join("\n---\n") }] };
    }
  );

  if (!readOnly) {
    server.tool(
      "write_file",
      {
        path: z.string(),
        content: z.string(),
      },
      async ({ path: filePath, content }) => {
        const validPath = await validatePath(filePath);
        await writeFileContent(validPath, content);
        return {
          content: [{ type: "text", text: `Successfully wrote to ${filePath}` }],
        };
      }
    );

    server.tool(
      "edit_file",
      {
        path: z.string(),
        edits: z.array(
          z.object({
            oldText: z.string(),
            newText: z.string(),
          })
        ),
        dryRun: z.boolean().optional().default(false),
      },
      async ({ path: filePath, edits, dryRun }) => {
        const validPath = await validatePath(filePath);
        const result = await applyFileEdits(validPath, edits, dryRun);
        return { content: [{ type: "text", text: result }] };
      }
    );

    server.tool(
      "create_directory",
      { path: z.string() },
      async ({ path: dirPath }) => {
        const validPath = await validatePath(dirPath);
        await fs.mkdir(validPath, { recursive: true });
        return {
          content: [{ type: "text", text: `Successfully created directory ${dirPath}` }],
        };
      }
    );

    server.tool(
      "move_file",
      {
        source: z.string(),
        destination: z.string(),
      },
      async ({ source, destination }) => {
        const validSource = await validatePath(source);
        const validDest = await validatePath(destination);
        await fs.rename(validSource, validDest);
        return {
          content: [{ type: "text", text: `Successfully moved ${source} to ${destination}` }],
        };
      }
    );
  }

  server.tool(
    "list_directory",
    { path: z.string() },
    async ({ path: dirPath }) => {
      const validPath = await validatePath(dirPath);
      const entries = await fs.readdir(validPath, { withFileTypes: true });
      const formatted = entries
        .map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`)
        .join("\n");
      return { content: [{ type: "text", text: formatted }] };
    }
  );

  server.tool(
    "list_directory_with_sizes",
    {
      path: z.string(),
      sortBy: z.enum(["name", "size"]).optional().default("name"),
    },
    async ({ path: dirPath, sortBy }) => {
      const validPath = await validatePath(dirPath);
      const entries = await fs.readdir(validPath, { withFileTypes: true });
      const detailed = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(validPath, entry.name);
          try {
            const stats = await fs.stat(entryPath);
            return { name: entry.name, isDirectory: entry.isDirectory(), size: stats.size };
          } catch {
            return { name: entry.name, isDirectory: entry.isDirectory(), size: 0 };
          }
        })
      );
      detailed.sort((a, b) =>
        sortBy === "size" ? b.size - a.size : a.name.localeCompare(b.name)
      );
      const lines = detailed.map(
        (e) =>
          `${e.isDirectory ? "[DIR]" : "[FILE]"} ${e.name.padEnd(30)} ${e.isDirectory ? "" : formatSize(e.size).padStart(10)}`
      );
      const totalFiles = detailed.filter((e) => !e.isDirectory).length;
      const totalDirs = detailed.filter((e) => e.isDirectory).length;
      const totalSize = detailed.reduce((s, e) => s + (e.isDirectory ? 0 : e.size), 0);
      return {
        content: [
          {
            type: "text",
            text: [
              ...lines,
              "",
              `Total: ${totalFiles} files, ${totalDirs} directories`,
              `Combined size: ${formatSize(totalSize)}`,
            ].join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "directory_tree",
    {
      path: z.string(),
      excludePatterns: z.array(z.string()).optional().default([]),
    },
    async ({ path: rootPath, excludePatterns }) => {
      async function buildTree(
        currentPath: string,
        patterns: string[]
      ): Promise<Array<Record<string, unknown>>> {
        const validPath = await validatePath(currentPath);
        const entries = await fs.readdir(validPath, { withFileTypes: true });
        const result: Array<Record<string, unknown>> = [];

        for (const entry of entries) {
          const relativePath = path.relative(rootPath, path.join(currentPath, entry.name));
          const excluded = patterns.some(
            (pattern) =>
              minimatch(relativePath, pattern, { dot: true }) ||
              minimatch(relativePath, `**/${pattern}`, { dot: true })
          );
          if (excluded) continue;

          const entryData: Record<string, unknown> = {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
          };
          if (entry.isDirectory()) {
            entryData.children = await buildTree(path.join(currentPath, entry.name), patterns);
          }
          result.push(entryData);
        }
        return result;
      }

      const tree = await buildTree(rootPath, excludePatterns);
      return { content: [{ type: "text", text: JSON.stringify(tree, null, 2) }] };
    }
  );

  server.tool(
    "search_files",
    {
      path: z.string(),
      pattern: z.string().describe("Glob pattern, e.g. **/*.vue"),
      excludePatterns: z.array(z.string()).optional().default([]),
    },
    async ({ path: searchPath, pattern, excludePatterns }) => {
      const validPath = await validatePath(searchPath);
      const allowed = getAllowedDirectories();
      const results = await searchFilesWithValidation(validPath, pattern, allowed, {
        excludePatterns,
      });
      return {
        content: [
          {
            type: "text",
            text: results.length ? results.join("\n") : "No matches found",
          },
        ],
      };
    }
  );

  server.tool(
    "get_file_info",
    { path: z.string() },
    async ({ path: filePath }) => {
      const validPath = await validatePath(filePath);
      const info = await getFileStats(validPath);
      const text = Object.entries(info)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "list_allowed_directories",
    "Returns directories this server can access (repo checkout, worktrees, context docs).",
    async () => {
      const dirs = getAllowedDirectories();
      return {
        content: [
          {
            type: "text",
            text: `Allowed directories:\n${dirs.map((d: string) => `  • ${d}`).join("\n")}`,
          },
        ],
      };
    }
  );
}
