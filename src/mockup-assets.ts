/**
 * Asset URL helpers for standalone HTML mockups (iframe srcDoc).
 */

// Source Sans Pro (NOT Source Sans 3 — different family; Pro matches the self-hosted OTF in the real app)
export const MOCKUP_ICON_STYLES = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block">',
  '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">',
].join("\n");

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
