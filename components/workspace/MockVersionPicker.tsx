"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MockRevision } from "@lib/utils/session-history";
import { formatVersionTime } from "@lib/utils/review-ui";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

function shortLabel(label: string, max = 32): string {
  return label.length > max ? `${label.slice(0, max)}…` : label;
}

interface Props {
  revisions: MockRevision[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
  align?: "left" | "right";
}

export function MockVersionPicker({
  revisions,
  selectedId,
  onSelect,
  disabled,
  compact,
  align = "right",
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        zIndex: 200,
        ...(align === "right"
          ? { right: Math.max(8, window.innerWidth - rect.right) }
          : { left: Math.max(8, rect.left) }),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (revisions.length === 0) return null;

  const selected = revisions.find((r) => r.id === selectedId) ?? revisions[revisions.length - 1];

  const menu = open ? (
    <div
      ref={menuRef}
      role="listbox"
      className="min-w-[280px] max-w-[320px] max-h-72 overflow-y-auto shadow-lg"
      style={{
        ...menuStyle,
        background: COLORS.surface,
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="px-3 py-2 border-b" style={{ borderColor: COLORS.border }}>
        <p style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Mock versions
        </p>
      </div>
      {revisions.map((r) => {
        const isSelected = r.id === selected.id;
        return (
          <button
            key={r.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onSelect(r.id);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 transition-colors hover:bg-gray-50"
            style={{
              background: isSelected ? COLORS.accentSoft : "transparent",
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p style={{ ...F.body, fontSize: 13, fontWeight: isSelected ? 600 : 500, color: COLORS.text }}>
                  v{r.index + 1} · {shortLabel(r.label, 40)}
                </p>
                <p style={{ ...F.body, fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                  {formatVersionTime(r.timestamp)}
                </p>
              </div>
              {isSelected && (
                <span style={{ ...F.body, fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>✓</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 max-w-[200px] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          ...F.body,
          fontSize: compact ? 12 : 13,
          fontWeight: 500,
          color: COLORS.text,
          background: COLORS.subtle,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.pill,
          padding: compact ? "6px 10px" : "8px 12px",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch mockup version"
      >
        <span className="truncate">
          v{selected.index + 1} · {shortLabel(selected.label, compact ? 24 : 32)}
        </span>
        <span style={{ color: COLORS.muted, fontSize: 10 }}>▾</span>
      </button>

      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
