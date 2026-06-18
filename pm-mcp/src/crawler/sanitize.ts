/**
 * Optional sanitizer for captured HTML. When enabled (CRAWL_SANITIZE=true),
 * replaces live data values with neutral placeholders while preserving DOM
 * structure, classes, and attributes so the rendered layout stays intact.
 *
 * This is a lightweight, structure-preserving scrubber — it is NOT a guarantee
 * of full PII removal. Only relevant if captures are shared off the local dev
 * machine.
 */

/** Scrub visible text + value-bearing attributes in an HTML string. */
export function sanitizeHtml(html: string): string {
  return (
    html
      // Replace text content between tags, preserving tags + whitespace.
      .replace(/>([^<]+)</g, (_match, text: string) => `>${scrubText(text)}<`)
      // Neutralize common value-bearing attributes.
      .replace(
        /(value|placeholder|title|alt|aria-label|data-[\w-]*)=("|')(.*?)\2/gi,
        (_m, attr: string, q: string, val: string) => `${attr}=${q}${scrubText(val)}${q}`
      )
  );
}

function scrubText(text: string): string {
  if (!text.trim()) return text;
  return text
    .replace(/\d/g, "0") // numbers → 0 (keeps digit grouping/width)
    .replace(/[A-Za-z]{4,}/g, (w) => maskWord(w)); // long words → masked
}

function maskWord(word: string): string {
  // Keep first letter for readability, mask the rest with 'x'.
  return word[0] + "x".repeat(Math.max(0, word.length - 1));
}
