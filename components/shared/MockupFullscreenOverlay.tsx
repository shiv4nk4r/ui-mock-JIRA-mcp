"use client";

import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { openHtmlInNewTab } from "@lib/utils/files";
import { MockupIframe } from "@/components/shared/MockupIframe";

interface Props {
  open: boolean;
  onClose: () => void;
  html: string;
  title: string;
  subtitle?: React.ReactNode;
}

export function MockupFullscreenOverlay({ open, onClose, html, title, subtitle }: Props) {
  if (!open || !html) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: COLORS.bg }}>
      <div
        className="flex-none flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
      >
        <div className="min-w-0">
          <p className="truncate" style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
            {title}
          </p>
          {subtitle && (
            <div className="mt-0.5" style={{ ...F.mono, fontSize: 12, color: COLORS.muted }}>
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openHtmlInNewTab(html)}
            className="px-3 py-1.5 text-xs font-medium"
            style={{ color: COLORS.accent, ...F.body }}
          >
            Open in new tab
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold"
            style={{ background: COLORS.text, color: "#fff", borderRadius: RADIUS.pill, ...F.body }}
          >
            Exit full screen
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-white">
        <MockupIframe html={html} className="w-full h-full" title={`${title} full screen`} />
      </div>
    </div>
  );
}
