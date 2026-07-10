"use client";

import { useEffect } from "react";
import { COLORS, RADIUS } from "@lib/design/tokens";

export function Toast({
  message,
  onDone,
  duration = 2800,
}: {
  message: string | null;
  onDone: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDone]);

  if (!message) return null;

  return (
    <div
      className="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 px-5 py-3 text-sm font-medium shadow-lg animate-[fade-in-up_0.25s_ease]"
      style={{
        background: "rgba(29, 29, 31, 0.92)",
        color: "#fff",
        borderRadius: RADIUS.pill,
        backdropFilter: "blur(12px)",
        fontFamily: "'Barlow', -apple-system, sans-serif",
      }}
      role="status"
    >
      {message}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  primary,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        borderRadius: RADIUS.pill,
        background: primary ? COLORS.accent : COLORS.subtle,
        color: primary ? "#fff" : COLORS.text,
        border: primary ? "none" : `1px solid ${COLORS.border}`,
      }}
    >
      {children ?? label}
    </button>
  );
}
