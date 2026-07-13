import { GREYORANGE_LOGO_DATA_URI } from "@lib/branding/greyorange-logo-data-uri";

const LOGO_IMG_TAG = `<img src="${GREYORANGE_LOGO_DATA_URI}" alt="GreyOrange" class="topbar-logo-img" height="28" />`;

const TOPBAR_PRODUCT = '<span class="topbar-product">Manager Dashboard</span>';

/** Official topbar logo block — use verbatim in every mock header. */
export function greyOrangeTopbarLogoHtml(): string {
  return `<a class="topbar-logo" href="#" aria-label="GreyOrange Manager Dashboard">${LOGO_IMG_TAG}${TOPBAR_PRODUCT}</a>`;
}

const TOPBAR_LOGO_CLASSES = "topbar-logo|top-bar-logo|logo-area|top-bar-logo-area";

const MOCK_LOGO_CSS = `
.topbar-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
.topbar-logo-img { height: 28px; width: auto; display: block; flex-shrink: 0; }
.topbar-product { font-size: 11px; color: var(--dark, #636f83); letter-spacing: 0.04em; white-space: nowrap; }
`.trim();

function injectLogoCss(html: string): string {
  if (html.includes(".topbar-logo-img")) return html;
  if (html.includes("</style>")) {
    return html.replace("</style>", `${MOCK_LOGO_CSS}\n</style>`);
  }
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n<style>${MOCK_LOGO_CSS}</style>`);
  }
  return html;
}

function normalizeTopbarLogoAnchor(html: string): string {
  const anchorRe = new RegExp(
    `<a\\s+[^>]*class="[^"]*(?:${TOPBAR_LOGO_CLASSES})[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi",
  );

  return html.replace(anchorRe, (full, inner: string) => {
    if (inner.includes(GREYORANGE_LOGO_DATA_URI)) {
      return full.replace(
        /<img[^>]*class="[^"]*topbar-logo-img[^"]*"[^>]*>/i,
        LOGO_IMG_TAG,
      );
    }

    const product =
      inner.match(/<span[^>]*class="[^"]*topbar-product[^"]*"[^>]*>[\s\S]*?<\/span>/i)?.[0] ??
      TOPBAR_PRODUCT;

    const open = full.slice(0, full.indexOf(">") + 1);
    return `${open}${LOGO_IMG_TAG}${product}</a>`;
  });
}

/** Enforce the official GreyOrange logo in mock HTML headers (standalone-safe data URI). */
export function applyMockBranding(html: string): string {
  if (!html?.trim()) return html;

  let out = html;

  out = out.replace(/src=["']GREYORANGE_LOGO_DATA_URI["']/gi, `src="${GREYORANGE_LOGO_DATA_URI}"`);
  out = out.replace(/src=["']\/branding\/greyorange-logo\.svg["']/gi, `src="${GREYORANGE_LOGO_DATA_URI}"`);
  out = out.replace(/<div class="logo-mark"[^>]*>[\s\S]*?<\/div>/gi, LOGO_IMG_TAG);
  out = out.replace(/<svg[^>]*class="[^"]*logo-gmark[^"]*"[\s\S]*?<\/svg>/gi, LOGO_IMG_TAG);
  out = out.replace(
    /<!--\s*GreyOrange G-mark[\s\S]*?<\/svg>/gi,
    LOGO_IMG_TAG,
  );

  out = normalizeTopbarLogoAnchor(out);
  out = injectLogoCss(out);

  return out;
}

export { GREYORANGE_LOGO_DATA_URI };

/** Replace logo placeholder in component-library.md before sending to the model. */
export function injectLogoIntoComponentLibraryContext(context: string): string {
  return context.replace(/GREYORANGE_LOGO_DATA_URI/g, GREYORANGE_LOGO_DATA_URI);
}
