/**
 * Optional sanitizer for captured HTML. When enabled (CRAWL_SANITIZE=true),
 * replaces live data values with neutral placeholders while preserving DOM
 * structure, classes, and attributes so the rendered layout stays intact.
 */

export function sanitizeHtml(html: string): string {
  return (
    html
      .replace(/>([^<]+)</g, (_match, text: string) => `>${scrubText(text)}<`)
      .replace(
        /(value|placeholder|title|alt|aria-label|data-[\w-]*)=("|')(.*?)\2/gi,
        (_m, attr: string, q: string, val: string) => `${attr}=${q}${scrubText(val)}${q}`
      )
  );
}

function scrubText(text: string): string {
  if (!text.trim()) return text;
  return text
    .replace(/\d/g, "0")
    .replace(/[A-Za-z]{4,}/g, (w) => maskWord(w));
}

function maskWord(word: string): string {
  return word[0] + "x".repeat(Math.max(0, word.length - 1));
}
