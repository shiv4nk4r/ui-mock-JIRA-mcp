"use client";

import { GreyOrangeLogo } from "@/components/shared/GreyOrangeLogo";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

const STEPS = [
  {
    title: "Connect a JIRA ticket",
    body: "Paste a ticket ID. GCC Studio pulls the summary, context, and requirements automatically.",
  },
  {
    title: "Generate an interactive mockup",
    body: "AI builds a clickable prototype aligned with GreyOrange UI patterns — ready to refine in minutes.",
  },
  {
    title: "Refine with conversation",
    body: "Describe changes in plain language. Each turn updates the mock while keeping ticket context in sync.",
  },
  {
    title: "Review with engineering",
    body: "Send mockups into a shared channel. Product and GCC approve, request changes, and discuss in one place.",
  },
  {
    title: "Ship with confidence",
    body: "Approved mockups include file-level guidance so engineering can move from prototype to production faster.",
  },
];

export function ProductOverview() {
  return (
    <section className="max-w-5xl mx-auto pt-10 sm:pt-16 pb-16 sm:pb-24">
      {/* First viewport: brand-led composition */}
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
        <div className="mb-8 sm:mb-10">
          <GreyOrangeLogo height={48} />
        </div>
        <p
          className="inline-flex items-center px-3 py-1 text-xs font-semibold mb-5"
          style={{
            ...F.body,
            color: COLORS.accent,
            background: COLORS.accentSoft,
            borderRadius: RADIUS.pill,
            border: `1px solid ${COLORS.accentBorder}`,
          }}
        >
          GCC Studio
        </p>
        <h1
          style={{
            ...F.body,
            fontSize: "clamp(2rem, 5.5vw, 3.25rem)",
            fontWeight: 560,
            color: COLORS.text,
            letterSpacing: "-0.035em",
            lineHeight: 1.12,
            marginBottom: 16,
          }}
        >
          From JIRA ticket to review-ready UI mockups
        </h1>
        <p
          className="max-w-xl mx-auto"
          style={{
            ...F.body,
            fontSize: 17,
            color: COLORS.muted,
            lineHeight: 1.55,
            marginBottom: 28,
          }}
        >
          Align product and engineering on what to build — generate, refine, and review mockups in one studio.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="#community-board"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-black/[0.04]"
            style={{
              ...F.body,
              color: COLORS.text,
              background: COLORS.surface,
              borderRadius: RADIUS.pill,
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            Browse the board
          </a>
          <p style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
            Sign in from the header to open Studio
          </p>
        </div>
      </div>

      {/* Audience strip — not cards; soft labels */}
      <div className="mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 max-w-4xl mx-auto text-center sm:text-left">
        {[
          { label: "Product", desc: "Visualize requirements and gather feedback early" },
          { label: "GCC", desc: "Review scope, approve mockups, and estimate build" },
          { label: "Everyone", desc: "Browse the community board — no sign-in needed" },
        ].map((item) => (
          <div key={item.label} className="space-y-1.5">
            <p style={{ ...F.body, fontSize: 14, fontWeight: 600, color: COLORS.accent }}>{item.label}</p>
            <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, lineHeight: 1.45 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* How it works — single column flow, not card grid */}
      <div className="mt-20 sm:mt-24 max-w-2xl mx-auto">
        <h2
          style={{
            ...F.body,
            fontSize: 22,
            fontWeight: 560,
            color: COLORS.text,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          How it works
        </h2>
        <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginBottom: 28, lineHeight: 1.5 }}>
          Five steps from ticket to approved mock.
        </p>
        <ol className="space-y-0">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="flex gap-4 py-5"
              style={{
                borderTop: i === 0 ? `1px solid ${COLORS.border}` : undefined,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <span
                className="shrink-0 w-8 h-8 flex items-center justify-center text-xs font-semibold mt-0.5"
                style={{
                  ...F.body,
                  background: COLORS.accentSoft,
                  color: COLORS.accent,
                  borderRadius: RADIUS.pill,
                }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p style={{ ...F.body, fontSize: 16, fontWeight: 560, color: COLORS.text }}>{s.title}</p>
                <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginTop: 4, lineHeight: 1.5 }}>
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
