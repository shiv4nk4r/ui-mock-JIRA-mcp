"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import { mockupGenerationStore } from "@lib/mockup/generation-store";
import type { TicketHistoryGroup } from "@lib/utils/session-history";
import { filterHistoryGroups } from "@lib/utils/session-history";
import { relativeTime } from "@lib/utils/review-ui";
import { jiraTicketUrl } from "@lib/utils/jira";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { GreyOrangeLogo } from "@/components/shared/GreyOrangeLogo";
import { DeleteTicketHistoryModal } from "@/components/workspace/DeleteTicketHistoryModal";

export interface TicketHistorySidebarProps {
  groups: TicketHistoryGroup[];
  loading?: boolean;
  activeTicketId?: string | null;
  onNewMock: () => void;
  onDeleted?: () => void;
  /** Gemini-style home chrome: logo, nav links, user footer, collapse. */
  homeChrome?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  reviewCount?: number;
  className?: string;
}

function RowOverflowMenu({
  group,
  jiraBaseUrl,
  onDelete,
}: {
  group: TicketHistoryGroup;
  jiraBaseUrl: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
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

  return (
    <div ref={rootRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Ticket actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-black/5 transition-opacity"
        style={{ ...F.body, fontSize: 16, color: COLORS.muted, lineHeight: 1 }}
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 min-w-[140px] py-1 shadow-lg overflow-hidden"
          style={{
            background: COLORS.surface,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <a
            href={jiraTicketUrl(group.ticketId, jiraBaseUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            style={{ ...F.body, color: COLORS.text }}
            onClick={() => setOpen(false)}
          >
            Open in JIRA
          </a>
          <button
            type="button"
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            style={{ ...F.body, color: "#D70015" }}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete history…
          </button>
        </div>
      )}
    </div>
  );
}

function TicketRow({
  group,
  active,
  jiraBaseUrl,
  onOpen,
  onDelete,
}: {
  group: TicketHistoryGroup;
  active: boolean;
  jiraBaseUrl: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group w-full flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors text-left"
      style={{
        background: active ? "rgba(0,0,0,0.05)" : "transparent",
        borderRadius: 20,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="truncate"
          style={{
            ...F.body,
            fontSize: 14,
            color: COLORS.text,
            fontWeight: active ? 560 : 450,
            letterSpacing: "-0.01em",
          }}
          title={group.summary}
        >
          {group.building ? "Building… " : ""}
          {group.summary || group.ticketId}
        </div>
        <div className="truncate mt-0.5" style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
          {group.ticketId}
          <span className="mx-1">·</span>
          {relativeTime(group.savedAt)}
          {group.building && " · in progress"}
        </div>
      </div>
      <RowOverflowMenu group={group} jiraBaseUrl={jiraBaseUrl} onDelete={onDelete} />
    </div>
  );
}

function ExpandSidebarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.75" />
      <path d="M13 9l3 3-3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapseSidebarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 9l-3 3 3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Favicon by default; swaps to expand icon on hover (Gemini pattern). */
function CollapsedBrandToggle({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Expand sidebar"
      title="Expand sidebar"
      className="group relative w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
      style={{ borderRadius: RADIUS.pill }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/favicon-32x32.png"
        alt=""
        width={28}
        height={28}
        className="absolute transition-opacity duration-150 opacity-100 group-hover:opacity-0 group-focus-visible:opacity-0"
        draggable={false}
      />
      <span
        className="absolute flex items-center justify-center transition-opacity duration-150 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{ color: COLORS.text }}
      >
        <ExpandSidebarIcon />
      </span>
    </button>
  );
}

export function TicketHistorySidebar({
  groups,
  loading,
  activeTicketId,
  onNewMock,
  onDeleted,
  homeChrome,
  collapsed = false,
  onCollapsedChange,
  reviewCount = 0,
  className,
}: TicketHistorySidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketHistoryGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const collapsedAvatarRef = useRef<HTMLButtonElement>(null);
  const [collapsedMenuPos, setCollapsedMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const jiraBaseUrl = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? "";

  const expandedWidth = homeChrome ? 300 : 280;
  const collapsedWidth = 72;

  useEffect(() => {
    if (!menuOpen || !collapsed) {
      setCollapsedMenuPos(null);
      return;
    }
    const el = collapsedAvatarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCollapsedMenuPos({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.right + 8,
    });
  }, [menuOpen, collapsed]);

  // Close account menu when sidebar expands/collapses
  useEffect(() => {
    setMenuOpen(false);
  }, [collapsed]);

  const visible = useMemo(
    () => filterHistoryGroups(groups, search),
    [groups, search],
  );

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      mockupGenerationStore.cancel(user.id, deleteTarget.ticketId);
      await repository.resetTicketHistory(user.id, deleteTarget.ticketId);
      setDeleteTarget(null);
      onDeleted?.();
      if (activeTicketId && activeTicketId.toUpperCase() === deleteTarget.ticketId.toUpperCase()) {
        router.push("/dashboard");
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete ticket history");
      setDeleting(false);
    }
  }

  return (
    <aside
      className={`flex flex-col h-full min-h-0 relative overflow-hidden ${className ?? ""}`}
      style={{
        width: collapsed ? collapsedWidth : expandedWidth,
        transition: "width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
        background: homeChrome ? COLORS.subtle : COLORS.surface,
        borderRight: homeChrome ? "none" : `1px solid ${COLORS.border}`,
        willChange: "width",
      }}
    >
      <DeleteTicketHistoryModal
        open={!!deleteTarget}
        ticketId={deleteTarget?.ticketId ?? ""}
        ticketSummary={deleteTarget?.summary}
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
          setDeleting(false);
        }}
        onConfirm={handleDelete}
      />

      {/* ── Collapsed chrome (fades in as width closes) ── */}
      {homeChrome && (
        <div
          className="flex flex-col items-center h-full min-h-0 py-3 gap-2 absolute inset-0 z-[1]"
          style={{
            width: collapsedWidth,
            opacity: collapsed ? 1 : 0,
            transition: "opacity 160ms ease",
            transitionDelay: collapsed ? "80ms" : "0ms",
            pointerEvents: collapsed ? "auto" : "none",
          }}
          aria-hidden={!collapsed}
        >
          <CollapsedBrandToggle onExpand={() => onCollapsedChange?.(false)} />
          <button
            type="button"
            aria-label="New mock"
            title="New mock"
            onClick={onNewMock}
            className="w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
            style={{
              borderRadius: RADIUS.pill,
              ...F.body,
              fontSize: 22,
              fontWeight: 600,
              color: COLORS.accent,
              lineHeight: 1,
            }}
          >
            +
          </button>
          <Link
            href="/search"
            aria-label="Search mocks"
            title="Search mocks"
            className="relative w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
            style={{
              borderRadius: RADIUS.pill,
              background: pathname.startsWith("/search") ? "rgba(0,0,0,0.06)" : "transparent",
              color: COLORS.text,
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            ⌕
          </Link>
          {user?.role === "internal" && (
            <Link
              href="/mockups"
              aria-label="Gallery"
              title="Gallery"
              className="w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
              style={{
                borderRadius: RADIUS.pill,
                background: pathname.startsWith("/mockups") ? "rgba(0,0,0,0.06)" : "transparent",
                color: COLORS.text,
                fontSize: 16,
              }}
            >
              ▦
            </Link>
          )}
          <Link
            href="/reviews"
            aria-label="Reviews"
            title="Reviews"
            className="relative w-10 h-10 flex items-center justify-center hover:bg-black/5 transition-colors"
            style={{
              borderRadius: RADIUS.pill,
              background: pathname.startsWith("/reviews") ? "rgba(0,0,0,0.06)" : "transparent",
              color: COLORS.text,
              fontSize: 16,
            }}
          >
            ◎
            {reviewCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center text-[9px] font-semibold text-white"
                style={{ background: COLORS.accent, borderRadius: RADIUS.pill }}
              >
                {reviewCount > 9 ? "9+" : reviewCount}
              </span>
            )}
          </Link>
          {user && (
            <div className="mt-auto pb-1 relative">
              <button
                ref={collapsedAvatarRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                title={user.name}
                className="w-9 h-9 flex items-center justify-center text-sm font-semibold hover:ring-2 hover:ring-black/10 transition-shadow"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
              >
                {user.name.charAt(0)}
              </button>
              {menuOpen && collapsed && collapsedMenuPos && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div
                    className="fixed z-[110] py-2 min-w-[180px] shadow-lg"
                    style={{
                      background: COLORS.surface,
                      borderRadius: RADIUS.md,
                      border: `1px solid ${COLORS.border}`,
                      bottom: collapsedMenuPos.bottom,
                      left: collapsedMenuPos.left,
                    }}
                  >
                    <div className="px-4 py-2 text-xs border-b" style={{ borderColor: COLORS.border, color: COLORS.muted }}>
                      {user.email}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false);
                        await signOut();
                        router.push("/login");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                      style={{ ...F.body, color: COLORS.text }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Expanded content (fades while collapsing) ── */}
      <div
        className="flex flex-col h-full min-h-0 absolute inset-0"
        style={{
          width: expandedWidth,
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? "translateX(-10px)" : "translateX(0)",
          transition: "opacity 160ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          pointerEvents: collapsed ? "none" : "auto",
        }}
        aria-hidden={collapsed}
      >
        {homeChrome && (
          <div className="flex-none flex items-center justify-between px-4 pt-4 pb-2">
            <Link href="/dashboard" className="flex items-center min-w-0">
              <GreyOrangeLogo height={32} />
            </Link>
            {onCollapsedChange && (
              <button
                type="button"
                aria-label="Collapse sidebar"
                onClick={() => onCollapsedChange(true)}
                className="w-9 h-9 flex items-center justify-center hover:bg-black/5 shrink-0 transition-colors"
                style={{ borderRadius: RADIUS.pill, color: COLORS.muted }}
                title="Collapse sidebar"
              >
                <CollapseSidebarIcon />
              </button>
            )}
          </div>
        )}

        <div className="flex-none px-3 pt-2 pb-1 space-y-1">
              <button
                type="button"
                onClick={onNewMock}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.06]"
                style={{
                  ...F.body,
                  background: COLORS.surface,
                  color: COLORS.text,
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <span aria-hidden style={{ fontSize: 18, lineHeight: 1, color: COLORS.accent }}>+</span>
                New mock
              </button>

          {homeChrome && (
            <>
              <Link
                href="/search"
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-black/[0.05]"
                style={{
                  ...F.body,
                  color: COLORS.text,
                  borderRadius: RADIUS.pill,
                  background: pathname === "/search" || pathname.startsWith("/search") ? "rgba(0,0,0,0.06)" : "transparent",
                  fontWeight: pathname.startsWith("/search") ? 560 : 400,
                }}
              >
                <span aria-hidden style={{ fontSize: 14, opacity: 0.7 }}>⌕</span>
                Search mocks
              </Link>
              {user?.role === "internal" && (
                <Link
                  href="/mockups"
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-black/[0.05]"
                  style={{
                    ...F.body,
                    color: COLORS.text,
                    borderRadius: RADIUS.pill,
                    fontWeight: pathname.startsWith("/mockups") ? 600 : 400,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 14, opacity: 0.7 }}>▦</span>
                  Gallery
                </Link>
              )}
              <Link
                href="/reviews"
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-black/[0.05]"
                style={{
                  ...F.body,
                  color: COLORS.text,
                  borderRadius: RADIUS.pill,
                  fontWeight: pathname.startsWith("/reviews") ? 600 : 400,
                }}
              >
                <span aria-hidden style={{ fontSize: 14, opacity: 0.7 }}>◎</span>
                Reviews
                {reviewCount > 0 && (
                  <span
                    className="ml-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold text-white"
                    style={{ background: COLORS.accent, borderRadius: RADIUS.pill }}
                  >
                    {reviewCount}
                  </span>
                )}
              </Link>
            </>
          )}

          {!homeChrome && (
            <input
              type="search"
              placeholder="Search tickets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm outline-none"
              style={{
                ...F.body,
                background: COLORS.subtle,
                color: COLORS.text,
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`,
              }}
            />
          )}
        </div>

        <div className="flex-none px-5 pt-4 pb-1">
          <div style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.muted, letterSpacing: "0.02em" }}>
            Recents
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2 space-y-0.5">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="signal-bars"><span /><span /><span /><span /><span /></div>
            </div>
          ) : visible.length === 0 ? (
            <p className="px-3 py-8 text-center" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
              {search.trim() ? "No tickets match" : "No mocks yet"}
            </p>
          ) : (
            visible.map((group) => (
              <TicketRow
                key={group.ticketId}
                group={group}
                active={
                  !!activeTicketId &&
                  activeTicketId.toUpperCase() === group.ticketId.toUpperCase()
                }
                jiraBaseUrl={jiraBaseUrl}
                onOpen={() =>
                  router.push(`/workspace/${encodeURIComponent(group.ticketId)}`)
                }
                onDelete={() => {
                  setDeleteError("");
                  setDeleting(false);
                  setDeleteTarget(group);
                }}
              />
            ))
          )}
        </div>

        {homeChrome && user && (
          <div
            className="flex-none relative px-3 py-3"
            style={{ borderTop: `1px solid ${COLORS.border}` }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-2 py-2 hover:bg-black/[0.04] transition-colors"
              style={{ borderRadius: 16 }}
            >
              <span
                className="w-9 h-9 flex items-center justify-center text-sm font-semibold shrink-0"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
              >
                {user.name.charAt(0)}
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className="block truncate" style={{ ...F.body, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                  {user.name}
                </span>
                <span className="block truncate" style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
                  {user.role === "internal" ? "Internal" : "External"}
                </span>
              </span>
              <span style={{ ...F.body, fontSize: 16, color: COLORS.muted }}>⚙</span>
            </button>
            {menuOpen && !collapsed && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)} aria-hidden />
                <div
                  className="absolute left-3 right-3 bottom-full mb-2 z-[110] py-2 shadow-lg"
                  style={{ background: COLORS.surface, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}
                >
                  <div className="px-4 py-2 text-xs" style={{ color: COLORS.muted }}>{user.email}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      router.push("/login");
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                    style={{ ...F.body, color: COLORS.text }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
