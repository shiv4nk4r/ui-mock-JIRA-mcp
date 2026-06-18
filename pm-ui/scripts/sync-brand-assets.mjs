#!/usr/bin/env node
/**
 * Sync Manager Dashboard brand assets into pm-ui/public for HTML mockup previews.
 *
 * Sources (first match wins):
 *   MDUI_PUBLIC_ROOT env
 *   ../mdui/public (sibling monorepo checkout)
 *   pm-mcp/.repos/manager-dashboard/mdui/public (MCP clone)
 *
 * Copies: icons/, logos/, and the GreyOrange header logo → img/
 *
 * Run: npm run sync-brand-assets -w pm-ui
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PM_UI_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(PM_UI_ROOT, "..");

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveMduiRoots() {
  const candidates = [
    process.env.MDUI_PUBLIC_ROOT,
    path.join(WORKSPACE_ROOT, "..", "mdui", "public"),
    path.join(WORKSPACE_ROOT, "pm-mcp", ".repos", "manager-dashboard", "mdui", "public"),
  ].filter(Boolean);

  for (const pub of candidates) {
    if (exists(path.join(pub, "icons"))) return { public: pub, assets: path.dirname(pub) };
  }
  return null;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  const roots = resolveMduiRoots();
  if (!roots) {
    console.error(
      "[sync-brand-assets] Could not find mdui/public/icons.\n" +
        "Set MDUI_PUBLIC_ROOT or clone manager-dashboard into pm-mcp/.repos/"
    );
    process.exit(1);
  }

  const out = path.join(PM_UI_ROOT, "public");
  const { public: mduiPublic, assets: mduiRoot } = roots;

  copyDir(path.join(mduiPublic, "icons"), path.join(out, "icons"));
  console.log(`[sync-brand-assets] icons → public/icons`);

  if (exists(path.join(mduiPublic, "logos"))) {
    copyDir(path.join(mduiPublic, "logos"), path.join(out, "logos"));
    console.log(`[sync-brand-assets] logos → public/logos`);
  }

  const logoSrc = path.join(mduiRoot, "src", "assets", "GO_Orange_Black_Horizontal.svg");
  if (exists(logoSrc)) {
    fs.mkdirSync(path.join(out, "img"), { recursive: true });
    fs.copyFileSync(logoSrc, path.join(out, "img", "GO_Orange_Black_Horizontal.svg"));
    console.log(`[sync-brand-assets] header logo → public/img/`);
  }

  if (exists(path.join(mduiPublic, "favicon.ico"))) {
    fs.copyFileSync(path.join(mduiPublic, "favicon.ico"), path.join(out, "favicon.ico"));
  }

  console.log(`[sync-brand-assets] Done from ${mduiPublic}`);
}

main();
