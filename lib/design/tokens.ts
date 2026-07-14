export const F = {
  display: { fontFamily: "'Bebas Neue', cursive" },
  condensed: { fontFamily: "'Barlow Condensed', sans-serif" },
  body: { fontFamily: "'Barlow', -apple-system, BlinkMacSystemFont, sans-serif" },
  mono: { fontFamily: "'Fira Code', ui-monospace, monospace" },
} as const;

export const COLORS = {
  accent: "#D97706",
  accentSoft: "rgba(217, 119, 6, 0.12)",
  accentWash: "rgba(217, 119, 6, 0.07)",
  accentBorder: "rgba(217, 119, 6, 0.22)",
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

const GREETING_TEMPLATES: Array<(name: string) => string> = [
  (n) => `Let's jump in, ${n}`,
  (n) => `What's the vibe, ${n}?`,
  (n) => `How are you, ${n}?`,
  (n) => `Hey ${n}`,
  (n) => `Good to see you, ${n}`,
  (n) => `Ready when you are, ${n}`,
  (n) => `Let's make something, ${n}`,
  (n) => `What's on the board, ${n}?`,
  (n) => `Hi ${n} — what'll it be?`,
  (n) => `${n}, shall we mock something up?`,
  (n) => `Welcome back, ${n}`,
  (n) => `Alright ${n}, what's next?`,
  (n) => `Hey ${n}, pick a ticket`,
  (n) => `Morning energy, ${n}?`,
  (n) => `Good morning, ${n}`,
  (n) => `Good afternoon, ${n}`,
  (n) => `Good evening, ${n}`,
];

function firstName(name: string): string {
  const part = name.trim().split(/\s+/)[0];
  return part || "there";
}

/** Casual rotating greetings (Gemini / Claude style). Call once per page visit. */
export function pickGreeting(name: string): string {
  const n = firstName(name);
  const h = new Date().getHours();
  const pool = GREETING_TEMPLATES.filter((fn) => {
    const sample = fn(n);
    if (sample.startsWith("Good morning") && (h < 5 || h >= 12)) return false;
    if (sample.startsWith("Good afternoon") && (h < 12 || h >= 17)) return false;
    if (sample.startsWith("Good evening") && h < 17) return false;
    if (sample.startsWith("Morning energy") && (h < 5 || h >= 12)) return false;
    return true;
  });
  const list = pool.length > 0 ? pool : GREETING_TEMPLATES;
  return list[Math.floor(Math.random() * list.length)](n);
}

/** @deprecated Prefer pickGreeting for variety; kept for time-of-day fallback. */
export function greeting(name: string): string {
  return pickGreeting(name);
}
