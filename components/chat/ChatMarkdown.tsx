"use client";

import { F } from "@lib/design/tokens";

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} style={{ fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} style={{ fontFamily: "'Fira Code',monospace", fontSize: "0.87em", color: "#D97706", background: "rgba(217,119,6,0.12)", padding: "1px 5px" }}>{p.slice(1, -1)}</code>;
    return p || null;
  });
}

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 8 }} />;
        if (/^### /.test(t))
          return <div key={i} className="mt-2 mb-1" style={{ ...F.condensed, fontSize: 13, fontWeight: 600, color: "#3A3530" }}>{renderInline(t.slice(4))}</div>;
        if (/^## /.test(t))
          return <div key={i} className="mt-2 mb-1" style={{ ...F.condensed, fontSize: 15, fontWeight: 700, color: "#1A1510" }}>{renderInline(t.slice(3))}</div>;
        if (/^[-*]\s/.test(t))
          return <div key={i} className="flex gap-2 mb-0.5"><span style={{ color: "#D97706", fontSize: 7, marginTop: 6 }}>▶</span><span style={{ ...F.body, fontSize: 13, lineHeight: 1.65 }}>{renderInline(t.slice(2))}</span></div>;
        return <div key={i} className="mb-1" style={{ ...F.body, fontSize: 13, lineHeight: 1.75 }}>{renderInline(t)}</div>;
      })}
    </div>
  );
}

export function EffortMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: 6 }} />;
        if (t.startsWith("### "))
          return <div key={i} style={{ ...F.condensed, fontSize: 13, fontWeight: 700, color: "#D97706", marginBottom: 8 }}>{t.slice(4)}</div>;
        if (t.startsWith("## "))
          return <div key={i} style={{ ...F.condensed, fontSize: 11, fontWeight: 600, color: "#3A3530", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.slice(3)}</div>;
        if (/^[-*]\s/.test(t))
          return <div key={i} style={{ ...F.body, fontSize: 12, color: "#4A4540", paddingLeft: 8 }}>{renderInline(t.slice(2))}</div>;
        return <div key={i} style={{ ...F.body, fontSize: 12, color: "#4A4540" }}>{renderInline(t)}</div>;
      })}
    </div>
  );
}
