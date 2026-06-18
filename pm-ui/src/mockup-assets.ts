/**
 * Asset URL helpers for standalone HTML mockups (iframe srcDoc).
 *
 * Manager Dashboard icon stacks:
 * 1. Material Icons + Material Symbols Outlined (Quasar q-icon ligatures)
 * 2. Font Awesome v5 (Quasar extras — e.g. fab fa-github)
 * 3. Custom PNG/SVG in mdui/public/icons/ and /logos/ (synced to pm-ui/public/)
 */

/** Stylesheets for Quasar icon font classes used in captured templates. */
export const MOCKUP_ICON_STYLES = [
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block">',
  '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">',
].join("\n");

/**
 * Rewrite captured live-app URLs so mockups load assets from pm-ui/public/.
 * In iframe srcDoc, root-relative paths (/icons/…) resolve against the pm-ui origin.
 */
export function rewriteMockupAssetUrls(html: string): string {
  if (!html?.trim()) return html;

  return html
    .replace(/https?:\/\/localhost:8080\//g, "/")
    .replace(/url\(&quot;https?:\/\/localhost:8080\//g, "url(&quot;/")
    .replace(/url\("https?:\/\/localhost:8080\//g, 'url("/')
    .replace(/url\('https?:\/\/localhost:8080\//g, "url('/")
    .replace(/src="icons\//g, 'src="/icons/')
    .replace(/href="icons\//g, 'href="/icons/');
}
