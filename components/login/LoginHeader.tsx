"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GreyOrangeLogo } from "@/components/shared/GreyOrangeLogo";
import { MoreMenuItem, MoreMenuPanel } from "@/components/shared/MoreMenu";
import { HUB_TABS, useHub } from "@/components/login/HubContext";
import { useAuth, MOCK_USERS } from "@lib/auth/auth-context";
import { isFirebaseEnabled, ALLOWED_EMAIL_DOMAIN } from "@lib/firebase/config";
import { roleTeamLabel } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

export function LoginHeader() {
  const router = useRouter();
  const { tab, setTab, counts } = useHub();
  const { user, isLoading, signInWithMockUser, signInWithGoogle, authError, clearAuthError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const useFirebase = isFirebaseEnabled();

  useEffect(() => {
    if (!menuOpen || !btnRef.current) return;
    function update() {
      const rect = btnRef.current!.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
        zIndex: 220,
        minWidth: 260,
      });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleGoogleSignIn() {
    clearAuthError();
    setSigningIn(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } finally {
      setSigningIn(false);
    }
  }

  function enterAs(userId: string) {
    signInWithMockUser(userId);
    setMenuOpen(false);
    router.push("/dashboard");
  }

  function selectTab(id: typeof tab) {
    setTab(id);
    document.getElementById("community-board")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header
      className="sticky top-0 z-[100] w-full"
      style={{
        background: "rgba(242,242,247,0.86)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <Link href="/login" className="flex items-center shrink-0 min-w-0">
          <GreyOrangeLogo height={30} />
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center" aria-label="Community board">
          {HUB_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-black/[0.04]"
                style={{
                  borderRadius: RADIUS.pill,
                  background: active ? COLORS.surface : "transparent",
                  color: active ? COLORS.text : COLORS.muted,
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                  border: `1px solid ${active ? COLORS.border : "transparent"}`,
                  ...F.body,
                }}
              >
                {t.label}
                {counts[t.id] > 0 && (
                  <span
                    className="min-w-[18px] h-[18px] px-1.5 flex items-center justify-center text-[10px] font-semibold"
                    style={{
                      background: active ? COLORS.accentSoft : COLORS.subtle,
                      color: active ? COLORS.accent : COLORS.muted,
                      borderRadius: RADIUS.pill,
                    }}
                  >
                    {counts[t.id]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isLoading ? (
            <div className="signal-bars scale-75">
              <span /><span /><span /><span /><span />
            </div>
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: COLORS.accent,
                  color: "#fff",
                  borderRadius: RADIUS.pill,
                  boxShadow: "0 6px 16px rgba(217,119,6,0.28)",
                  ...F.body,
                }}
              >
                Open Studio
              </Link>
              <span
                className="hidden sm:inline-flex w-9 h-9 items-center justify-center text-sm font-semibold"
                style={{
                  background: COLORS.accentSoft,
                  color: COLORS.accent,
                  borderRadius: "50%",
                  boxShadow: `inset 0 0 0 1px ${COLORS.accentBorder}`,
                }}
                title={user.name}
              >
                {user.name.charAt(0)}
              </span>
            </>
          ) : (
            <div ref={rootRef} className="relative">
              <button
                ref={btnRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={signingIn}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="px-4 py-2.5 text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
                style={{
                  background: COLORS.accent,
                  color: "#fff",
                  borderRadius: RADIUS.pill,
                  boxShadow: "0 6px 16px rgba(217,119,6,0.28)",
                  ...F.body,
                }}
              >
                {signingIn ? "Signing in…" : "Sign in"}
              </button>
              {menuOpen &&
                typeof document !== "undefined" &&
                createPortal(
                  <MoreMenuPanel menuRef={menuRef} style={menuStyle}>
                    {useFirebase ? (
                      <>
                        <MoreMenuItem label="Continue with Google" onClick={handleGoogleSignIn} />
                        <p
                          className="px-3 py-2 text-center"
                          style={{ ...F.body, fontSize: 11, color: COLORS.muted }}
                        >
                          @{ALLOWED_EMAIL_DOMAIN} only
                        </p>
                      </>
                    ) : (
                      MOCK_USERS.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          role="menuitem"
                          onClick={() => enterAs(u.id)}
                          className="group w-full text-left flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl transition-colors duration-150 hover:bg-black/[0.05] active:bg-black/[0.09]"
                        >
                          <span
                            className="w-9 h-9 flex items-center justify-center text-sm font-semibold shrink-0"
                            style={{
                              background: COLORS.accentSoft,
                              color: COLORS.accent,
                              borderRadius: "50%",
                            }}
                          >
                            {u.name.charAt(0)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className="block leading-snug"
                              style={{ ...F.body, fontSize: 13, fontWeight: 550, color: COLORS.text }}
                            >
                              {u.name}
                            </span>
                            <span
                              className="block mt-0.5"
                              style={{ ...F.body, fontSize: 11, color: COLORS.muted }}
                            >
                              {roleTeamLabel(u.role)}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </MoreMenuPanel>,
                  document.body,
                )}
            </div>
          )}
        </div>
      </div>

      <nav
        className="md:hidden flex gap-1.5 px-5 pb-3 overflow-x-auto"
        aria-label="Community board"
      >
        {HUB_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
              style={{
                borderRadius: RADIUS.pill,
                background: active ? COLORS.surface : "transparent",
                color: active ? COLORS.text : COLORS.muted,
                border: `1px solid ${active ? COLORS.border : "transparent"}`,
                ...F.body,
              }}
            >
              {t.label}
              {counts[t.id] > 0 && ` · ${counts[t.id]}`}
            </button>
          );
        })}
      </nav>

      {authError && !user && (
        <p
          className="max-w-5xl mx-auto px-5 sm:px-8 pb-3 text-sm"
          style={{ ...F.body, color: "#D70015" }}
        >
          {authError}
        </p>
      )}
    </header>
  );
}
