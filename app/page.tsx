"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const F = {
  display:   { fontFamily: "'Bebas Neue', 'Impact', sans-serif" },
  condensed: { fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" },
  body:      { fontFamily: "'Barlow', 'Helvetica Neue', sans-serif" },
  mono:      { fontFamily: "'Fira Code', 'Courier New', monospace" },
};

export default function HubPage() {
  const router = useRouter();
  const [mockupCount, setMockupCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/mockups")
      .then((r) => r.json())
      .then((list: unknown[]) => setMockupCount(list.length))
      .catch(() => setMockupCount(0));
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F4F2" }}>

      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-4 border-b bg-white"
        style={{ borderColor: "#E8E5E0" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: "#D97706" }}
          />
          <span style={{ ...F.condensed, fontSize: 13, color: "#D97706", letterSpacing: "0.25em", textTransform: "uppercase", fontWeight: 600 }}>
            PM Orchestrator
          </span>
        </div>
        <span style={{ ...F.mono, fontSize: 10, color: "#A8A39C", letterSpacing: "0.08em" }}>
          GreyOrange · Manager Dashboard
        </span>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 py-16">
        <div className="mb-12 text-center">
          <h1
            className="leading-none mb-3"
            style={{ ...F.display, fontSize: "clamp(48px,8vw,72px)", color: "#1A1510", letterSpacing: "0.02em" }}
          >
            ORCHESTRATOR
          </h1>
          <p style={{ ...F.body, fontSize: 14, color: "#6A6560", letterSpacing: "0.02em" }}>
            Choose a workspace
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 w-full max-w-2xl md:grid-cols-2">

          {/* Mock Generation */}
          <button
            onClick={() => router.push("/generate")}
            className="group text-left flex flex-col gap-5 p-7 border bg-white transition-all duration-150"
            style={{ borderColor: "#E8E5E0", borderRadius: 6 }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#D97706";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(217,119,6,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#E8E5E0";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              className="w-9 h-9 flex items-center justify-center rounded"
              style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.2)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div>
              <div style={{ ...F.condensed, fontSize: 18, fontWeight: 700, color: "#1A1510", letterSpacing: "0.04em", marginBottom: 6 }}>
                MOCK GENERATION
              </div>
              <p style={{ ...F.body, fontSize: 13, color: "#6A6560", lineHeight: 1.6 }}>
                Enter a JIRA ticket ID. The tool reads your codebase and generates a UI mockup in under 90 seconds.
              </p>
            </div>
            <div
              className="flex items-center gap-2 mt-auto"
              style={{ ...F.condensed, fontSize: 11, color: "#D97706", letterSpacing: "0.15em", textTransform: "uppercase" }}
            >
              Open workspace
              <span className="group-hover:translate-x-1 transition-transform duration-150 opacity-60">──▶</span>
            </div>
          </button>

          {/* Review Mockups */}
          <button
            onClick={() => router.push("/mockups")}
            className="group text-left flex flex-col gap-5 p-7 border bg-white transition-all duration-150"
            style={{ borderColor: "#E8E5E0", borderRadius: 6 }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#1A1510";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(26,21,16,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#E8E5E0";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div
              className="w-9 h-9 flex items-center justify-center rounded"
              style={{ background: "#F5F4F2", border: "1px solid #E8E5E0" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6A6560" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <span style={{ ...F.condensed, fontSize: 18, fontWeight: 700, color: "#1A1510", letterSpacing: "0.04em" }}>
                  REVIEW MOCKUPS
                </span>
                {mockupCount !== null && mockupCount > 0 && (
                  <span style={{
                    ...F.mono, fontSize: 10, fontWeight: 600,
                    background: "#FEF3C7", color: "#D97706",
                    padding: "2px 7px", borderRadius: 10,
                  }}>
                    {mockupCount}
                  </span>
                )}
              </div>
              <p style={{ ...F.body, fontSize: 13, color: "#6A6560", lineHeight: 1.6 }}>
                Browse all generated mockups. Preview, open full page, download HTML, and view execution breakdowns.
              </p>
            </div>
            <div
              className="flex items-center gap-2 mt-auto"
              style={{ ...F.condensed, fontSize: 11, color: "#4A4540", letterSpacing: "0.15em", textTransform: "uppercase" }}
            >
              {mockupCount === 0 ? "No mockups yet" : "Browse gallery"}
              {(mockupCount ?? 0) > 0 && (
                <span className="group-hover:translate-x-1 transition-transform duration-150 opacity-50">──▶</span>
              )}
            </div>
          </button>

        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-4 flex items-center justify-between border-t bg-white" style={{ borderColor: "#E8E5E0" }}>
        <span style={{ ...F.mono, fontSize: 9, color: "#C4C0BA", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Claude Code · MCP · Quasar v1
        </span>
        <span style={{ ...F.mono, fontSize: 9, color: "#C4C0BA", letterSpacing: "0.08em" }}>
          ~/claude-ui-designs/
        </span>
      </footer>
    </div>
  );
}
