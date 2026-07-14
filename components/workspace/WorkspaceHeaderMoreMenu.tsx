"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { formatCostUsd } from "@lib/utils/usage-cost";
import { MoreMenuItem, MoreMenuPanel, MoreMenuSeparator } from "@/components/shared/MoreMenu";

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
    <MoreMenuPanel menuRef={menuRef} style={menuStyle}>
      <MoreMenuItem
        label="Full screen"
        onClick={() => run(onFullscreen)}
        disabled={fullscreenDisabled}
      />
      <MoreMenuItem
        label="Download HTML"
        onClick={() => run(onDownload)}
        disabled={downloadDisabled}
      />
      <MoreMenuItem label="Share link" onClick={() => run(onShare)} disabled={shareDisabled} />
      {showCost && onCost && (
        <MoreMenuItem
          label="View cost"
          detail={formatCostUsd(costUsd)}
          onClick={() => run(onCost)}
          disabled={costDisabled}
        />
      )}
      {hasReviewChannel && onReviewChannel && (
        <MoreMenuItem label="Review channel" onClick={() => run(onReviewChannel)} />
      )}
      <MoreMenuSeparator />
      <MoreMenuItem
        label="Delete history…"
        onClick={() => run(onDelete)}
        disabled={deleteDisabled}
        danger
      />
    </MoreMenuPanel>
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
        className="inline-flex items-center justify-center transition-colors hover:bg-black/5 disabled:opacity-40"
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
