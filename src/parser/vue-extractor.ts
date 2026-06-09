/**
 * Vue SFC <script> block extractor.
 *
 * Handles all real-world variants found in this codebase:
 *   <script>              — Vue 2 Options API (most common here)
 *   <script lang="ts">   — TypeScript Options API
 *   <script setup>       — Composition API (rare in Vue 2 Quasar)
 *   <script setup lang="ts">
 *
 * The extractor returns the raw script content PLUS the 1-based line number
 * where that content begins inside the original .vue file. The parser uses
 * this offset to produce accurate loc data that maps back to the real file.
 */

export type ScriptLang = 'js' | 'ts';

export interface ScriptBlock {
  /** Raw JS/TS text (without the <script> tags) */
  content: string;
  /** Language detected from lang attribute */
  lang: ScriptLang;
  /** 1-based line number inside the .vue file where `content` starts */
  startLine: number;
  /** true if this is a <script setup> block */
  isSetup: boolean;
}

/**
 * Extract the first <script> block from a .vue SFC source string.
 * Returns null if no script block is present.
 */
export function extractScriptBlock(vueSource: string): ScriptBlock | null {
  // Regex covers: <script>, <script setup>, <script lang="ts">, <script setup lang="ts">
  // Non-greedy match on content, case-insensitive tag, handles any attribute order.
  const scriptRe =
    /<script((?:\s+(?:setup|lang=["'][^"']*["']|[a-zA-Z:_][\w:.-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?))*)\s*>([\s\S]*?)<\/script>/i;

  const match = scriptRe.exec(vueSource);
  if (!match) return null;

  const attrsStr = match[1] ?? '';
  const content  = match[2];

  // Detect lang attribute
  const langMatch = /\blang=["']([^"']+)["']/i.exec(attrsStr);
  const lang: ScriptLang = langMatch?.[1]?.toLowerCase() === 'ts' ? 'ts' : 'js';

  // Detect <script setup>
  const isSetup = /\bsetup\b/i.test(attrsStr);

  // Calculate the 1-based line number where the content begins.
  // match.index is where <script...> opens in the source.
  // We need to count newlines from the start up through the opening tag.
  const openingTag = match[0].slice(0, match[0].indexOf(content));
  const prefixToContent = vueSource.slice(0, match.index!) + openingTag;
  const startLine = prefixToContent.split('\n').length; // 1-based

  return { content, lang, startLine, isSetup };
}

/**
 * Quick check: does this .vue file have any <script> block at all?
 * Useful to skip template-only SFCs early without running the full regex.
 */
export function hasScriptBlock(vueSource: string): boolean {
  return /<script[\s>]/i.test(vueSource);
}
