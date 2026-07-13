"use client";

import { F, COLORS, RADIUS } from "@lib/design/tokens";

/** 16:9 — standard for modern web dashboards and SaaS layouts. */
export const MOCK_PREVIEW_ASPECT = 16 / 9;

interface Props {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function MockupAspectFrame({ children, label = "16:9", className = "" }: Props) {
  return (
    <div
      className={`flex-1 min-h-0 min-w-0 flex flex-col items-center justify-center p-4 ${className}`}
      style={{ containerType: "size", background: COLORS.subtle }}
    >
      <div
        className="relative overflow-hidden shrink-0"
        style={{
          aspectRatio: `${16} / ${9}`,
          width: "min(100cqw, calc(100cqh * 16 / 9))",
          maxHeight: label ? "calc(100cqh - 1.5rem)" : "100cqh",
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.lg,
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div className="absolute inset-0">{children}</div>
      </div>
      {label && (
        <p
          className="mt-2 shrink-0"
          style={{ ...F.body, fontSize: 11, color: COLORS.muted, letterSpacing: "0.02em" }}
        >
          Preview frame · {label}
        </p>
      )}
    </div>
  );
}
