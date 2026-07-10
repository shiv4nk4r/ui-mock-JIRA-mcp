"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const F = {
  display:   { fontFamily: "'Bebas Neue', 'Impact', sans-serif" },
  condensed: { fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" },
  body:      { fontFamily: "'Barlow', 'Helvetica Neue', sans-serif" },
  mono:      { fontFamily: "'Fira Code', 'Courier New', monospace" },
};

interface MockupFile {
  filename:      string;
  ticketId:      string;
  sizeBytes:     number;
  sizeLabel:     string;
  modifiedAt:    string;
  modifiedLabel: string;
  hasAnalysis:   boolean;
}

interface AnalysisData {
  displayText: string;
  model:       string;
  generatedAt: string;
}

// ── Effort estimation parser ──────────────────────────────────────────────────

interface ParsedEffort {
  tShirtSize:  string;
  points:      string;
  riskFactor:  string;
  riskLevel:   "Low" | "Medium" | "High" | "";
  breakdown:   string[];
  rawText:     string;
}

function parseEffortEstimation(text: string | undefined | null): ParsedEffort {
  if (!text) return { tShirtSize: "", points: "", riskFactor: "", riskLevel: "", breakdown: [], rawText: "" };
  const tShirtSize = text.match(/T-Shirt Size[^:]*:\s*\*?\*?\s*([SMLX]+)/i)?.[1]?.trim() ?? "";
  const points     = text.match(/Story Points[^:]*:\s*\*?\*?\s*(\d+)/i)?.[1]?.trim() ?? "";
  const riskMatch  = text.match(/Architecture Risk Factor[^:]*:\s*\*?\*?\s*(Low|Medium|High)/i);
  const riskFactor = riskMatch?.[0]?.replace(/Architecture Risk Factor[^:]*:\s*\*?\*?\s*/i, "").trim() ?? "";
  const riskLevel  = (riskMatch?.[1] ?? "") as ParsedEffort["riskLevel"];

  // Extract breakdown bullet points
  const breakdownBlock = text.match(/Breakdown Analysis[^:]*:([\s\S]*?)(?=\*\*Architecture|\n---|\n##|$)/i)?.[1] ?? "";
  const breakdown = breakdownBlock
    .split("\n")
    .map((l) => l.replace(/^\s*[\*\-]\s+/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 0);

  return { tShirtSize, points, riskFactor, riskLevel, breakdown, rawText: text };
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Low:    { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
  Medium: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  High:   { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
};

const SIZE_COLORS: Record<string, { bg: string; text: string }> = {
  S:   { bg: "#F0FDF4", text: "#166534" },
  M:   { bg: "#EFF6FF", text: "#1E40AF" },
  L:   { bg: "#FFFBEB", text: "#92400E" },
  XL:  { bg: "#FFF1F2", text: "#9F1239" },
  XXL: { bg: "#FDF4FF", text: "#6B21A8" },
};

function downloadFile(filename: string) {
  const a = document.createElement("a");
  a.href = `/api/mockups/${encodeURIComponent(filename)}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function MockupsPage() {
  const router = useRouter();
  const [mockups, setMockups]     = useState<MockupFile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [preview, setPreview]     = useState<MockupFile | null>(null);
  const [analysis, setAnalysis]   = useState<{ file: MockupFile; data: AnalysisData | null; loading: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/mockups")
      .then((r) => r.json())
      .then((list: MockupFile[]) => { setMockups(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function openAnalysis(m: MockupFile) {
    setAnalysis({ file: m, data: null, loading: true });
    fetch(`/api/mockups/analysis?id=${encodeURIComponent(m.ticketId)}`)
      .then((r) => r.json())
      .then((data: AnalysisData) => setAnalysis({ file: m, data, loading: false }))
      .catch(() => setAnalysis({ file: m, data: null, loading: false }));
  }

  const filtered = mockups.filter((m) =>
    m.ticketId.toLowerCase().includes(search.toLowerCase())
  );

  const effort = analysis?.data ? parseEffortEstimation(analysis.data.displayText ?? "") : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F4F2" }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white flex-none" style={{ borderColor: "#E8E5E0" }}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-60"
            style={{ ...F.condensed, fontSize: 11, color: "#6A6560", letterSpacing: "0.15em", textTransform: "uppercase" }}
          >
            ← Hub
          </button>
          <span style={{ color: "#D0CCC6", fontSize: 14 }}>|</span>
          <span style={{ ...F.condensed, fontSize: 14, fontWeight: 700, color: "#1A1510", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Generated Mockups
          </span>
          {!loading && (
            <span style={{
              ...F.mono, fontSize: 10, fontWeight: 600,
              background: "#FEF3C7", color: "#D97706",
              padding: "2px 8px", borderRadius: 10,
            }}>
              {mockups.length}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Filter by ticket ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm outline-none transition-colors"
            style={{
              ...F.mono, fontSize: 11, width: 200,
              borderColor: "#E8E5E0", background: "#FAFAF9",
              color: "#1A1510",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#D97706")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "#E8E5E0")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              style={{ fontSize: 14, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {loading && (
          <div className="flex items-center justify-center py-32">
            <span style={{ ...F.condensed, fontSize: 12, color: "#A8A39C", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Loading…
            </span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div style={{ ...F.display, fontSize: 48, color: "#D0CCC6", lineHeight: 1 }}>EMPTY</div>
            <p style={{ ...F.body, fontSize: 14, color: "#8A8680" }}>
              {search
                ? `No mockups matching "${search}"`
                : "No mockups generated yet. Go to Mock Generation and create one."}
            </p>
            {!search && (
              <button
                onClick={() => router.push("/generate")}
                className="mt-2 px-5 py-2 rounded border transition-colors hover:bg-amber-50"
                style={{
                  ...F.condensed, fontSize: 11,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "#D97706", borderColor: "rgba(217,119,6,0.4)",
                  background: "#FFFBEB",
                }}
              >
                Generate First Mockup
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {filtered.map((m) => (
              <div
                key={m.filename}
                className="flex flex-col bg-white border rounded-md overflow-hidden transition-shadow duration-150 hover:shadow-md"
                style={{ borderColor: "#E8E5E0" }}
              >
                {/* Card header */}
                <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#F0EDE8" }}>
                  <div className="flex items-start justify-between gap-2">
                    <span style={{ ...F.mono, fontSize: 14, fontWeight: 600, color: "#D97706", letterSpacing: "0.04em" }}>
                      {m.ticketId}
                    </span>
                    <span style={{
                      ...F.mono, fontSize: 9,
                      background: "#F5F4F2", color: "#8A8680",
                      padding: "2px 6px", borderRadius: 3,
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {m.sizeLabel}
                    </span>
                  </div>
                  <div className="mt-1" style={{ ...F.body, fontSize: 11, color: "#8A8680" }}>
                    {m.modifiedLabel}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex divide-x" style={{ borderColor: "#F0EDE8" }}>

                  {/* Preview */}
                  <button
                    onClick={() => setPreview(m)}
                    className="flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors hover:bg-gray-50"
                    style={{ ...F.condensed, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4A4540" }}
                    title="Preview mockup"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Preview
                  </button>

                  {/* Execution Details */}
                  <button
                    onClick={() => openAnalysis(m)}
                    className="flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors hover:bg-amber-50"
                    style={{
                      ...F.condensed, fontSize: 10,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      color: m.hasAnalysis ? "#D97706" : "#C4C0BA",
                    }}
                    title={m.hasAnalysis ? "View execution details and task breakdown" : "No analysis available — regenerate this mockup"}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    Execution Details
                  </button>

                  {/* Open */}
                  <button
                    onClick={() => window.open(`/api/mockups/${encodeURIComponent(m.filename)}`, "_blank")}
                    className="py-2.5 px-3 flex items-center justify-center transition-colors hover:bg-gray-50"
                    style={{ color: "#8A8680" }}
                    title="Open in new tab"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                  </button>

                  {/* Download */}
                  <button
                    onClick={() => downloadFile(m.filename)}
                    className="py-2.5 px-3 flex items-center justify-center transition-colors hover:bg-gray-50"
                    style={{ color: "#8A8680" }}
                    title={`Download ${m.filename}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                  </button>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Preview overlay ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b bg-white flex-none" style={{ borderColor: "#E8E5E0" }}>
            <div className="flex items-center gap-3">
              <span style={{ ...F.mono, fontSize: 13, fontWeight: 600, color: "#D97706" }}>{preview.ticketId}</span>
              <span style={{ ...F.body, fontSize: 11, color: "#8A8680" }}>{preview.modifiedLabel} · {preview.sizeLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(`/api/mockups/${encodeURIComponent(preview.filename)}`, "_blank")}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs transition-colors hover:bg-amber-50"
                style={{ ...F.condensed, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#D97706", borderColor: "rgba(217,119,6,0.35)" }}
              >
                ⤢ Full Page
              </button>
              <button
                onClick={() => downloadFile(preview.filename)}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs transition-colors hover:bg-amber-50"
                style={{ ...F.condensed, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#D97706", borderColor: "rgba(217,119,6,0.35)" }}
              >
                ↓ Download
              </button>
              <button
                onClick={() => setPreview(null)}
                className="w-7 h-7 flex items-center justify-center border rounded transition-colors hover:bg-gray-100"
                style={{ borderColor: "#E8E5E0", color: "#6A6560", fontSize: 16 }}
              >
                ×
              </button>
            </div>
          </div>
          <iframe
            src={`/api/mockups/${encodeURIComponent(preview.filename)}`}
            className="flex-1 w-full"
            style={{ border: "none", background: "#fff" }}
            title={`Preview — ${preview.ticketId}`}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      )}

      {/* ── Execution Details panel ── */}
      {analysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div
            className="bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden w-full max-w-2xl"
            style={{ maxHeight: "85vh", borderColor: "#E8E5E0", border: "1px solid #E8E5E0" }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#F0EDE8" }}>
              <div>
                <div style={{ ...F.condensed, fontSize: 16, fontWeight: 700, color: "#1A1510", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Execution Details
                </div>
                <div style={{ ...F.mono, fontSize: 11, color: "#D97706", marginTop: 2 }}>
                  {analysis.file.ticketId}
                </div>
              </div>
              <button
                onClick={() => setAnalysis(null)}
                className="w-8 h-8 flex items-center justify-center border rounded transition-colors hover:bg-gray-100"
                style={{ borderColor: "#E8E5E0", color: "#6A6560", fontSize: 18 }}
              >
                ×
              </button>
            </div>

            {/* Panel body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {analysis.loading && (
                <div className="flex items-center justify-center py-16">
                  <span style={{ ...F.condensed, fontSize: 12, color: "#A8A39C", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    Loading…
                  </span>
                </div>
              )}

              {!analysis.loading && !analysis.data && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C4C0BA" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                  </svg>
                  <p style={{ ...F.body, fontSize: 13, color: "#8A8680", textAlign: "center" }}>
                    No execution details found.<br/>
                    Regenerate this mockup to capture analysis data.
                  </p>
                </div>
              )}

              {!analysis.loading && analysis.data && effort && (
                <div className="space-y-5">

                  {/* Summary badges */}
                  <div className="flex flex-wrap gap-3">
                    {effort.tShirtSize && (() => {
                      const c = SIZE_COLORS[effort.tShirtSize] ?? { bg: "#F5F4F2", text: "#4A4540" };
                      return (
                        <div className="flex flex-col items-center px-5 py-3 rounded-md" style={{ background: c.bg, border: `1px solid ${c.bg}` }}>
                          <span style={{ ...F.display, fontSize: 28, color: c.text, lineHeight: 1 }}>{effort.tShirtSize}</span>
                          <span style={{ ...F.condensed, fontSize: 9, color: c.text, opacity: 0.7, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>T-Shirt Size</span>
                        </div>
                      );
                    })()}

                    {effort.points && (
                      <div className="flex flex-col items-center px-5 py-3 rounded-md" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                        <span style={{ ...F.display, fontSize: 28, color: "#1E40AF", lineHeight: 1 }}>{effort.points}</span>
                        <span style={{ ...F.condensed, fontSize: 9, color: "#1E40AF", opacity: 0.7, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>Story Points</span>
                      </div>
                    )}

                    {effort.riskLevel && (() => {
                      const c = RISK_COLORS[effort.riskLevel] ?? RISK_COLORS.Low;
                      return (
                        <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-md" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                          <div>
                            <div style={{ ...F.condensed, fontSize: 9, color: c.text, opacity: 0.7, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Architecture Risk</div>
                            <div style={{ ...F.body, fontSize: 13, color: c.text, fontWeight: 600 }}>{effort.riskFactor}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Task breakdown */}
                  {effort.breakdown.length > 0 && (
                    <div>
                      <div style={{ ...F.condensed, fontSize: 11, fontWeight: 700, color: "#4A4540", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                        Breakdown
                      </div>
                      <div className="space-y-2">
                        {effort.breakdown.map((item, i) => {
                          const [label, ...rest] = item.split("—").map((s) => s.trim());
                          const detail = rest.join("—").trim();
                          return (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 rounded"
                              style={{ background: "#FAFAF9", border: "1px solid #F0EDE8" }}
                            >
                              <div
                                className="flex-none w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                                style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}
                              >
                                <span style={{ ...F.mono, fontSize: 8, color: "#D97706", fontWeight: 700 }}>{i + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div style={{ ...F.body, fontSize: 13, color: "#1A1510", fontWeight: 600 }}>{label}</div>
                                {detail && <div style={{ ...F.body, fontSize: 12, color: "#6A6560", marginTop: 2 }}>{detail}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Model + date */}
                  <div
                    className="flex items-center justify-between pt-3 border-t"
                    style={{ borderColor: "#F0EDE8" }}
                  >
                    <span style={{ ...F.mono, fontSize: 10, color: "#A8A39C" }}>
                      Model: {analysis.data.model}
                    </span>
                    <span style={{ ...F.mono, fontSize: 10, color: "#A8A39C" }}>
                      {new Date(analysis.data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
