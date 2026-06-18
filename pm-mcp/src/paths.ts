import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the pm-mcp project root (parent of src/). */
export const PM_MCP_ROOT = path.resolve(__dirname, "..");

/** Branch-scoped code-graph cache file path. */
export function cachePathForBranch(branch: string): string {
  const safeBranch = branch.replace(/[^a-zA-Z0-9._/-]/g, "_");
  return path.join(PM_MCP_ROOT, ".cache", safeBranch, "code-graph.json");
}
