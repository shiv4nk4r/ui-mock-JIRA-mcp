export const F = {
  display: { fontFamily: "'Bebas Neue', cursive" },
  condensed: { fontFamily: "'Barlow Condensed', sans-serif" },
  body: { fontFamily: "'Barlow', -apple-system, BlinkMacSystemFont, sans-serif" },
  mono: { fontFamily: "'Fira Code', ui-monospace, monospace" },
} as const;

export const COLORS = {
  accent: "#D97706",
  accentSoft: "rgba(217, 119, 6, 0.12)",
  bg: "#F5F5F7",
  surface: "#FFFFFF",
  border: "#E5E5EA",
  text: "#1D1D1F",
  muted: "#86868B",
  subtle: "#F2F2F7",
} as const;

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 9999,
} as const;

export const SESSION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In progress",
  pending_review: "In review",
  reviewed: "Reviewed",
  needs_changes: "Needs changes",
};

export const SESSION_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: "#636f83", bg: "rgba(99,111,131,0.1)" },
  in_progress: { color: "#2982cc", bg: "rgba(41,130,204,0.1)" },
  pending_review: { color: "#f9b115", bg: "rgba(249,177,21,0.1)" },
  reviewed: { color: "#66bb6a", bg: "rgba(102,187,106,0.1)" },
  needs_changes: { color: "#ED3324", bg: "rgba(237,51,36,0.1)" },
};

export function greeting(name: string): string {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}
