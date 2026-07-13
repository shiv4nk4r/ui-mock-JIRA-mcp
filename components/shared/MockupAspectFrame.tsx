"use client";

import { useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

export type MockAspectPreset = "16:9" | "4:3";

const ASPECTS: Record<MockAspectPreset, { width: number; height: number }> = {
  "16:9": { width: 16, height: 9 },
  "4:3": { width: 4, height: 3 },
};

/** Default preview aspect — modern web dashboards and SaaS layouts. */
export const MOCK_PREVIEW_ASPECT = 16 / 9;

interface Props {
  children: React.ReactNode;
  className?: string;
  showAspectToggle?: boolean;
}

export function MockupAspectFrame({ children, className = "", showAspectToggle = true }: Props) {
  const [aspect, setAspect] = useState<MockAspectPreset>("16:9");
  const [hovered, setHovered] = useState(false);

  const { width, height } = ASPECTS[aspect];
  const alternate: MockAspectPreset = aspect === "16:9" ? "4:3" : "16:9";

  function toggleAspect() {
    setAspect((current) => (current === "16:9" ? "4:3" : "16:9"));
  }

  return (
    <div
      className={`flex-1 min-h-0 min-w-0 flex flex-col items-center justify-center p-4 ${className}`}
      style={{ containerType: "size", background: COLORS.subtle }}
    >
      <div
        className="relative overflow-hidden shrink-0 transition-[width,max-height] duration-200 ease-out"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100cqw, calc(100cqh * ${width} / ${height}))`,
          maxHeight: showAspectToggle ? "calc(100cqh - 1.5rem)" : "100cqh",
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.lg,
          background: "#fff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div className="absolute inset-0">{children}</div>
      </div>
      {showAspectToggle && (
        <button
          type="button"
          onClick={toggleAspect}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="mt-2 shrink-0 transition-colors"
          style={{
            ...F.body,
            fontSize: 11,
            color: hovered ? COLORS.accent : COLORS.muted,
            letterSpacing: "0.02em",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: RADIUS.sm,
          }}
          title={`Switch to ${alternate}`}
        >
          {hovered ? `Switch to ${alternate}` : `Preview frame · ${aspect}`}
        </button>
      )}
    </div>
  );
}
