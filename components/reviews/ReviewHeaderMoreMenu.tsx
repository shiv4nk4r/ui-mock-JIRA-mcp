"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { formatCostUsd } from "@lib/utils/usage-cost";

function MenuItem({
  label,
  detail,
  onClick,
  disabled,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
      style={{ ...F.body, fontSize: 13, fontWeight: 500, color: COLORS.text }}
    >
      <span className="block">{label}</span>
      {detail && (
        <span className="block mt-0.5" style={{ ...F.mono, fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>
          {detail}
        </span>
      )}
    </button>
  );
}

export function ReviewHeaderMoreMenu({
  onFullscreen,
  onDownload,
  onCost,
  onPlan,
  showCost,
  costUsd,
  showPlan,
  fullscreenDisabled,
  downloadDisabled,
}: {
  onFullscreen: () => void;
  onDownload: () => void;
  onCost?: () => void;
  onPlan?: () => void;
  showCost?: boolean;
  costUsd?: number;
  showPlan?: boolean;
  fullscreenDisabled?: boolean;
  downloadDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      const menu = document.getElementById("review-header-more-menu");
      if (menu?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
      zIndex: 200,
    });
  }, [open]);

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center hover:bg-black/5 transition-colors"
        style={{
          borderRadius: RADIUS.pill,
          ...F.body,
          fontSize: 18,
          color: COLORS.muted,
          lineHeight: 1,
          background: open ? "rgba(0,0,0,0.05)" : "transparent",
        }}
      >
        ⋯
      </button>
      {open &&
        createPortal(
          <div
            id="review-header-more-menu"
            role="menu"
            className="min-w-[180px] py-1 shadow-lg overflow-hidden"
            style={{
              ...menuStyle,
              background: COLORS.surface,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <MenuItem label="Full screen" onClick={() => run(onFullscreen)} disabled={fullscreenDisabled} />
            <MenuItem label="Download HTML" onClick={() => run(onDownload)} disabled={downloadDisabled} />
            {showCost && onCost && (
              <MenuItem
                label="Cost"
                detail={formatCostUsd(costUsd ?? 0)}
                onClick={() => run(onCost)}
              />
            )}
            {showPlan && onPlan && (
              <MenuItem label="Implementation plan" onClick={() => run(onPlan)} />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
