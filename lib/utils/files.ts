import type { AttachedFile } from "@lib/types";
import { normalizeMockupHtml } from "@lib/utils/mockup-html";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const TEXT_EXTS = new Set([
  ".txt", ".md", ".json", ".ts", ".tsx", ".js", ".jsx", ".vue", ".css", ".scss",
  ".py", ".java", ".yaml", ".yml", ".csv", ".xml", ".sh", ".env", ".graphql",
  ".gql", ".toml", ".ini", ".html", ".htm", ".sql", ".prisma", ".tf",
]);

export async function readFileContent(file: File): Promise<AttachedFile> {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const isText =
    file.type.startsWith("text/") ||
    TEXT_EXTS.has(ext) ||
    file.type.includes("json") ||
    file.type.includes("yaml");
  const isHtml = ext === ".html" || ext === ".htm" || file.type.includes("text/html");
  const isImage = file.type.startsWith("image/");
  const base = {
    name: file.name,
    type: file.type,
    size: file.size,
    sizeLabel: formatBytes(file.size),
  };
  if ((isText || isHtml) && file.size < 200_000) {
    const raw: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsText(file);
    });
    if (isHtml) return { ...base, content: raw.slice(0, 50_000), contentType: "html" };
    return { ...base, content: raw.slice(0, 15_000), contentType: "text" };
  }
  if (isImage) {
    return {
      ...base,
      content: `[Image: ${file.name} — ${formatBytes(file.size)}]`,
      contentType: "image",
    };
  }
  return {
    ...base,
    content: `[${file.name} — ${file.type || "binary"}, ${formatBytes(file.size)}]`,
    contentType: "binary",
  };
}

export function openHtmlInNewTab(html: string) {
  const clean = normalizeMockupHtml(html);
  if (!clean) return;
  const blob = new Blob([clean], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
