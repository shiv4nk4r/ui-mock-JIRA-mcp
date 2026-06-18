import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the pm-ui package root. */
export const PM_UI_ROOT = path.resolve(__dirname, "..");

/** Absolute path to the poc-mcp workspace root (parent of pm-ui). */
export const WORKSPACE_ROOT = path.resolve(PM_UI_ROOT, "..");

/** Path to the shared .mcp.json used by Claude Code. */
export const MCP_CONFIG_PATH = path.join(WORKSPACE_ROOT, ".mcp.json");
