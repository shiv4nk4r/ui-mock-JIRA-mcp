import fs from "node:fs";
import path from "node:path";

export const BRAND_ASSET_EXTS = new Set([
  ".svg",
  ".png",
  ".ico",
  ".webp",
  ".jpg",
  ".jpeg",
  ".gif",
]);

export interface BrandAssetEntry {
  /** Relative id without extension, e.g. icons/inventory/audit */
  id: string;
  fileName: string;
  category: "icons" | "logos" | "asset";
  subpath: string;
  /** URL path served by Quasar from mdui/public/, e.g. /icons/inventory/audit.png */
  appPath: string;
  absolutePath: string;
  ext: string;
  sizeBytes: number;
}

export function mduiPublicRoot(repoRoot: string): string {
  return path.join(repoRoot, "mdui", "public");
}

export function scanBrandAssets(repoRoot: string): BrandAssetEntry[] {
  const publicRoot = mduiPublicRoot(repoRoot);
  if (!fs.existsSync(publicRoot)) return [];

  const results: BrandAssetEntry[] = [];

  function walk(dir: string, relFromPublic: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = relFromPublic ? `${relFromPublic}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!BRAND_ASSET_EXTS.has(ext)) continue;

      const normalized = rel.replace(/\\/g, "/");
      const category: BrandAssetEntry["category"] = normalized.startsWith("icons/")
        ? "icons"
        : normalized.startsWith("logos/")
          ? "logos"
          : "asset";

      results.push({
        id: normalized.replace(/\.[^.]+$/, ""),
        fileName: entry.name,
        category,
        subpath: normalized,
        appPath: `/${normalized}`,
        absolutePath: abs,
        ext,
        sizeBytes: fs.statSync(abs).size,
      });
    }
  }

  walk(publicRoot, "");
  return results.sort((a, b) => a.appPath.localeCompare(b.appPath));
}

export function findBrandAssets(
  assets: BrandAssetEntry[],
  query: string,
  limit = 30
): BrandAssetEntry[] {
  const q = query.toLowerCase().replace(/^\/+/, "");
  return assets
    .filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.fileName.toLowerCase().includes(q) ||
        a.subpath.toLowerCase().includes(q) ||
        a.appPath.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

export function resolveBrandAsset(
  assets: BrandAssetEntry[],
  query: string
): BrandAssetEntry | undefined {
  const normalized = query.trim().replace(/^\/+/, "");
  const withSlash = normalized.startsWith("icons/") || normalized.startsWith("logos/")
    ? `/${normalized}`
    : normalized;

  const exact = assets.find(
    (a) =>
      a.subpath === normalized ||
      a.appPath === withSlash ||
      a.appPath === `/${normalized}` ||
      a.id === normalized ||
      a.fileName === normalized
  );
  if (exact) return exact;

  const matches = findBrandAssets(assets, normalized, 1);
  return matches[0];
}

export function formatAssetCatalog(assets: BrandAssetEntry[]): string {
  const icons = assets.filter((a) => a.category === "icons");
  const logos = assets.filter((a) => a.category === "logos");
  const other = assets.filter((a) => a.category === "asset");

  const lines: string[] = [
    "OFFICIAL BRAND ASSETS (mdui/public/) — use ONLY these in UI mockups.",
    "Do NOT invent, redraw, or substitute Material/FontAwesome icons when a real asset exists.",
    "Call get-brand-icon(<path-or-keyword>) to fetch embeddable SVG/PNG for HTML mockups.",
    "",
    `Total: ${assets.length} files (${icons.length} icons, ${logos.length} logos, ${other.length} other)`,
    "",
  ];

  const fmt = (list: BrandAssetEntry[]) =>
    list.map((a) => `  ${a.appPath}`).join("\n");

  if (logos.length) {
    lines.push("## Logos (/logos/)", fmt(logos), "");
  }

  const iconGroups = new Map<string, BrandAssetEntry[]>();
  for (const icon of icons) {
    const folder = icon.subpath.includes("/")
      ? icon.subpath.split("/").slice(0, -1).join("/")
      : "icons";
    if (!iconGroups.has(folder)) iconGroups.set(folder, []);
    iconGroups.get(folder)!.push(icon);
  }

  for (const [folder, items] of [...iconGroups.entries()].sort()) {
    lines.push(`## ${folder}/`, fmt(items), "");
  }

  if (other.length) {
    lines.push("## Other (/public root)", fmt(other));
  }

  return lines.join("\n");
}

export function readBrandAssetForEmbed(
  absolutePath: string,
  appPath: string
): {
  appPath: string;
  mimeType: string;
  embeddingHtml: string;
  rawSvg?: string;
  base64?: string;
} {
  const ext = path.extname(absolutePath).toLowerCase();
  const buf = fs.readFileSync(absolutePath);

  if (ext === ".svg") {
    const svg = buf.toString("utf-8");
    const base64 = Buffer.from(svg).toString("base64");
    return {
      appPath,
      mimeType: "image/svg+xml",
      embeddingHtml: `<img src="data:image/svg+xml;base64,${base64}" alt="" />`,
      rawSvg: svg,
      base64,
    };
  }

  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
  };
  const mimeType = mimeMap[ext] ?? "application/octet-stream";
  const base64 = buf.toString("base64");
  return {
    appPath,
    mimeType,
    embeddingHtml: `<img src="data:${mimeType};base64,${base64}" alt="" />`,
    base64,
  };
}
