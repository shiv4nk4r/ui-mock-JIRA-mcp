"use client";

import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  messageCount?: number;
  /** @deprecated Use showFab={false} and a header trigger on review pages */
  fabBottom?: number;
  showFab?: boolean;
}

export function ReviewChannelChatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ReviewChannelDrawer({
  open,
  onOpenChange,
  children,
  messageCount = 0,
  fabBottom = 24,
  showFab = true,
}: Props) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[110] bg-black/25 lg:bg-black/15"
          onClick={() => onOpenChange(false)}
          aria-label="Close review channel"
        />
      )}

      <aside
        role="dialog"
        aria-modal={open}
        aria-label="Review channel"
        className="fixed z-[115] flex flex-col shadow-2xl transition-transform duration-300 ease-out"
        style={{
          top: 0,
          right: 0,
          height: "100dvh",
          width: "min(100vw, 420px)",
          background: COLORS.surface,
          borderLeft: `1px solid ${COLORS.border}`,
          transform: open ? "translateX(0)" : "translateX(100%)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {children}
      </aside>

      {showFab && (
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="fixed z-[115] flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{
            bottom: fabBottom,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: open ? COLORS.text : COLORS.accent,
            color: "#fff",
            border: `2px solid ${COLORS.surface}`,
          }}
          aria-label={open ? "Close review channel" : "Open review channel"}
          title={open ? "Close review channel" : "Review channel"}
        >
          {open ? (
            <span style={{ ...F.body, fontSize: 22, lineHeight: 1 }}>×</span>
          ) : (
            <ReviewChannelChatIcon size={24} />
          )}
          {!open && messageCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold"
              style={{ background: COLORS.text, color: "#fff", borderRadius: RADIUS.pill, border: `2px solid ${COLORS.surface}` }}
            >
              {messageCount > 9 ? "9+" : messageCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
