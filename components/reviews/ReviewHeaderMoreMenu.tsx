"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { formatCostUsd } from "@lib/utils/usage-cost";
import { MoreMenuItem, MoreMenuPanel } from "@/components/shared/MoreMenu";

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
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
    function update() {
      const rect = btnRef.current!.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right),
        zIndex: 200,
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
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
        aria-haspopup="menu"
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
        typeof document !== "undefined" &&
        createPortal(
          <MoreMenuPanel id="review-header-more-menu" menuRef={menuRef} style={menuStyle}>
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
            {showCost && onCost && (
              <MoreMenuItem
                label="Cost"
                detail={formatCostUsd(costUsd ?? 0)}
                onClick={() => run(onCost)}
              />
            )}
            {showPlan && onPlan && (
              <MoreMenuItem label="Implementation plan" onClick={() => run(onPlan)} />
            )}
          </MoreMenuPanel>,
          document.body,
        )}
    </div>
  );
}
