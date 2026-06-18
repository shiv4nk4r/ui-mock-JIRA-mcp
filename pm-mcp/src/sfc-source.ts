import fs from "node:fs";

export interface SfcStyleBlock {
  content: string;
  scoped: boolean;
  lang: string;
}

export interface SfcSource {
  template: string | null;
  styles: SfcStyleBlock[];
  /** Slot names declared in the template, e.g. ["default", "header"] */
  slots: string[];
  /** Child component tags referenced in the template (kebab + Pascal) */
  usedTags: string[];
}

/** Extract the <template>…</template> block (outermost) from SFC source. */
export function extractTemplateBlock(vueSource: string): string | null {
  const open = vueSource.search(/<template(\s[^>]*)?>/i);
  if (open === -1) return null;
  const startTagEnd = vueSource.indexOf(">", open) + 1;

  // Walk to find the matching closing </template> (handle nested <template> in slots)
  let depth = 0;
  const re = /<\/?template(\s[^>]*)?>/gi;
  re.lastIndex = open;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vueSource))) {
    const tag = m[0];
    if (/^<template/i.test(tag)) depth++;
    else depth--;
    if (depth === 0) {
      return vueSource.slice(startTagEnd, m.index).trim();
    }
  }
  return vueSource.slice(startTagEnd).trim();
}

/** Extract all <style> blocks with their scoped/lang attributes. */
export function extractStyleBlocks(vueSource: string): SfcStyleBlock[] {
  const blocks: SfcStyleBlock[] = [];
  const re = /<style((?:\s+[^>]*)?)>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vueSource))) {
    const attrs = m[1] ?? "";
    const langMatch = attrs.match(/lang=["']([^"']+)["']/i);
    blocks.push({
      content: (m[2] ?? "").trim(),
      scoped: /\bscoped\b/i.test(attrs),
      lang: langMatch?.[1] ?? "css",
    });
  }
  return blocks;
}

/** Slot names declared in the template (<slot> and <slot name="x">). */
export function extractSlots(template: string): string[] {
  const slots = new Set<string>();
  const re = /<slot(\s[^>]*)?\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    const attrs = m[1] ?? "";
    const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
    slots.add(nameMatch?.[1] ?? "default");
  }
  return [...slots];
}

/** Child component tags used in the template (q-* Quasar + custom kebab/Pascal). */
export function extractUsedTags(template: string): string[] {
  const tags = new Set<string>();
  const re = /<([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)/g;
  const HTML_TAGS = new Set([
    "div","span","p","a","ul","ol","li","table","thead","tbody","tr","td","th",
    "img","button","input","label","form","section","header","footer","nav",
    "h1","h2","h3","h4","h5","h6","br","hr","template","slot","i","b","strong",
    "em","small","svg","path","g","rect","circle","style","script","main","aside",
  ]);
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    const tag = m[1];
    if (HTML_TAGS.has(tag.toLowerCase())) continue;
    tags.add(tag);
  }
  return [...tags].sort();
}

/** Read an SFC file and return its template, styles, slots, and used tags. */
export function readSfcSource(absolutePath: string): SfcSource {
  const source = fs.readFileSync(absolutePath, "utf-8");
  const template = extractTemplateBlock(source);
  const styles = extractStyleBlocks(source);
  return {
    template,
    styles,
    slots: template ? extractSlots(template) : [],
    usedTags: template ? extractUsedTags(template) : [],
  };
}
