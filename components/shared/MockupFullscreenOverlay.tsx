"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { DownloadIcon } from "@/components/shared/DownloadIcon";
import { openHtmlInNewTab, downloadHtmlFile } from "@lib/utils/files";
import { MockupIframe } from "@/components/shared/MockupIframe";
import { MockupAspectFrame } from "@/components/shared/MockupAspectFrame";

interface Props {
  open: boolean;
  onClose: () => void;
  html: string;
  title: string;
  subtitle?: React.ReactNode;
  downloadFilename?: string;
}

export function MockupFullscreenOverlay({ open, onClose, html, title, subtitle, downloadFilename }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !html || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col" style={{ background: COLORS.bg }}>
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
            onClick={() => downloadHtmlFile(html, downloadFilename ?? `${title}.html`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
            style={{ color: COLORS.text, ...F.body, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.pill }}
          >
            <DownloadIcon size={14} />
            Download HTML
          </button>
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
      <MockupAspectFrame className="flex-1">
        <MockupIframe html={html} className="w-full h-full" title={`${title} full screen`} />
      </MockupAspectFrame>
    </div>,
    document.body,
  );
}
