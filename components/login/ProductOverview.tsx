"use client";

import { F, COLORS, RADIUS } from "@lib/design/tokens";

const STEPS = [
  {
    step: "01",
    title: "Connect a JIRA ticket",
    body: "Paste a ticket ID or pick one from your queue. GCC Studio pulls the summary, context, and requirements automatically.",
  },
  {
    step: "02",
    title: "Generate an interactive mockup",
    body: "AI builds a clickable HTML prototype aligned with GreyOrange UI patterns — ready to refine in minutes, not days.",
  },
  {
    step: "03",
    title: "Refine with conversation",
    body: "Describe changes in plain language. Each iteration updates the mock while keeping ticket context in sync.",
  },
  {
    step: "04",
    title: "Review with engineering",
    body: "Send mockups into a shared review channel. PMs and engineers approve, request changes, and discuss in one thread.",
  },
  {
    step: "05",
    title: "Ship with confidence",
    body: "Approved mockups include implementation guidance so engineering can move from prototype to production faster.",
  },
];

export function ProductOverview() {
  return (
    <section className="space-y-10">
      <div className="space-y-4 max-w-2xl">
        <p
          className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider"
          style={{ ...F.body, color: COLORS.accent, background: COLORS.accentSoft, borderRadius: RADIUS.pill }}
        >
          GCC Studio
        </p>
        <h1
          style={{
            ...F.body,
            fontSize: "clamp(2rem, 5vw, 2.75rem)",
            fontWeight: 600,
            color: COLORS.text,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
          }}
        >
          From JIRA ticket to review-ready UI mockups
        </h1>
        <p style={{ ...F.body, fontSize: 17, color: COLORS.muted, lineHeight: 1.65 }}>
          GCC Studio helps product and engineering teams align on what to build before a single line of code is written.
          Generate mockups, iterate quickly, and run structured reviews — all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "For product teams", desc: "Visualize requirements and gather feedback early" },
          { label: "For engineering", desc: "Review scope, approve mockups, and estimate build" },
          { label: "For everyone", desc: "Browse the community board below — no sign-in required" },
        ].map((card) => (
          <div
            key={card.label}
            className="p-5"
            style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
          >
            <p style={{ ...F.body, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{card.label}</p>
            <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 6, lineHeight: 1.5 }}>{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <h2 style={{ ...F.body, fontSize: 20, fontWeight: 600, color: COLORS.text }}>How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="flex gap-4 p-5"
              style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
            >
              <span
                className="shrink-0 w-9 h-9 flex items-center justify-center text-xs font-bold"
                style={{ ...F.mono, background: COLORS.subtle, color: COLORS.accent, borderRadius: RADIUS.sm }}
              >
                {s.step}
              </span>
              <div>
                <p style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>{s.title}</p>
                <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginTop: 4, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
