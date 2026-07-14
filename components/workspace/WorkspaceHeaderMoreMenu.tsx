"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { formatCostUsd } from "@lib/utils/usage-cost";

export interface WorkspaceHeaderMoreMenuProps {
  onFullscreen: () => void;
  onDownload: () => void;
  onShare: () => void;
  onCost?: () => void;
  onReviewChannel?: () => void;
  onDelete: () => void;
  showCost?: boolean;
  costUsd?: number;
  hasReviewChannel?: boolean;
  fullscreenDisabled?: boolean;
  downloadDisabled?: boolean;
  shareDisabled?: boolean;
  costDisabled?: boolean;
  deleteDisabled?: boolean;
}

function MenuItem({
  label,
  detail,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
      style={{
        ...F.body,
        fontSize: 13,
        fontWeight: 500,
        color: danger ? "#D70015" : COLORS.text,
      }}
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

export function WorkspaceHeaderMoreMenu({
  onFullscreen,
  onDownload,
  onShare,
  onCost,
  onReviewChannel,
  onDelete,
  showCost = false,
  costUsd = 0,
  hasReviewChannel = false,
  fullscreenDisabled,
  downloadDisabled,
  shareDisabled,
  costDisabled,
  deleteDisabled,
}: WorkspaceHeaderMoreMenuProps) {
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
        right: Math.max(8, window.innerWidth - rect.right),
        zIndex: 200,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      className="min-w-[200px] max-w-[260px] shadow-lg overflow-hidden"
      style={{
        ...menuStyle,
        background: COLORS.surface,
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="py-1">
        <MenuItem
          label="Full screen"
          onClick={() => run(onFullscreen)}
          disabled={fullscreenDisabled}
        />
        <MenuItem
          label="Download HTML"
          onClick={() => run(onDownload)}
          disabled={downloadDisabled}
        />
        <MenuItem label="Share link" onClick={() => run(onShare)} disabled={shareDisabled} />
        {showCost && onCost && (
          <MenuItem
            label="View cost"
            detail={formatCostUsd(costUsd)}
            onClick={() => run(onCost)}
            disabled={costDisabled}
          />
        )}
        {hasReviewChannel && onReviewChannel && (
          <MenuItem label="Review channel" onClick={() => run(onReviewChannel)} />
        )}
      </div>
      <div style={{ borderTop: `1px solid ${COLORS.border}` }} className="py-1">
        <MenuItem
          label="Delete history…"
          onClick={() => run(onDelete)}
          disabled={deleteDisabled}
          danger
        />
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
        className="inline-flex items-center justify-center transition-colors hover:bg-gray-100 disabled:opacity-40"
        style={{
          ...F.body,
          width: 36,
          height: 36,
          borderRadius: RADIUS.pill,
          background: open ? COLORS.subtle : "transparent",
          color: COLORS.text,
          border: `1px solid ${open ? COLORS.border : "transparent"}`,
          fontSize: 18,
          lineHeight: 1,
          letterSpacing: 1,
        }}
      >
        ⋯
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
