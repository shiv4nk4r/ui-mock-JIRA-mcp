"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { F, COLORS } from "@lib/design/tokens";

export function MoreMenuPanel({
  children,
  style,
  id,
  menuRef,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  id?: string;
  menuRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div
      ref={menuRef}
      id={id}
      role="menu"
      className={`min-w-[200px] max-w-[280px] overflow-hidden ${className ?? ""}`}
      style={{
        background: COLORS.surface,
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.05)",
        ...style,
      }}
    >
      <div className="p-1.5 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function MoreMenuSeparator() {
  return (
    <div
      role="separator"
      className="my-1 mx-1.5"
      style={{ height: 1, background: COLORS.border }}
    />
  );
}

export function MoreMenuItem({
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
      className={[
        "group w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer",
        "rounded-xl transition-colors duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        danger
          ? "hover:bg-[rgba(215,0,21,0.08)] active:bg-[rgba(215,0,21,0.14)]"
          : "hover:bg-black/[0.05] active:bg-black/[0.09]",
      ].join(" ")}
      style={{
        ...F.body,
        fontSize: 13,
        fontWeight: 550,
        color: danger ? "#D70015" : COLORS.text,
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block leading-snug">{label}</span>
        {detail && (
          <span
            className="block mt-0.5 leading-snug"
            style={{ ...F.mono, fontSize: 11, color: COLORS.muted, fontWeight: 400 }}
          >
            {detail}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="shrink-0 opacity-40 group-hover:opacity-100 transition-all duration-150 group-hover:translate-x-0.5"
        style={{
          ...F.body,
          fontSize: 15,
          color: danger ? "#D70015" : COLORS.muted,
          lineHeight: 1,
        }}
      >
        ›
      </span>
    </button>
  );
}
