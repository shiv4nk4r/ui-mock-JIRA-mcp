"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GreyOrangeLogo } from "@/components/shared/GreyOrangeLogo";
import { HUB_TABS, useHub } from "@/components/login/HubContext";
import { useAuth, MOCK_USERS } from "@lib/auth/auth-context";
import { isFirebaseEnabled, ALLOWED_EMAIL_DOMAIN } from "@lib/firebase/config";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

export function LoginHeader() {
  const router = useRouter();
  const { tab, setTab, counts } = useHub();
  const { user, isLoading, signInWithMockUser, signInWithGoogle, authError, clearAuthError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const useFirebase = isFirebaseEnabled();

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
      className="sticky top-0 z-[100] w-full border-b"
      style={{ background: "rgba(245,245,247,0.92)", backdropFilter: "blur(12px)", borderColor: COLORS.border }}
    >
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <Link href="/login" className="flex items-center shrink-0">
          <GreyOrangeLogo height={26} />
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {HUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors"
              style={{
                borderRadius: RADIUS.pill,
                background: tab === t.id ? COLORS.surface : "transparent",
                color: tab === t.id ? COLORS.text : COLORS.muted,
                boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                ...F.body,
              }}
            >
              {t.label}
              {counts[t.id] > 0 && (
                <span
                  className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: tab === t.id ? COLORS.accent : COLORS.border,
                    color: tab === t.id ? "#fff" : COLORS.muted,
                    borderRadius: RADIUS.pill,
                  }}
                >
                  {counts[t.id]}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isLoading ? (
            <div className="signal-bars scale-75"><span /><span /><span /><span /><span /></div>
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-semibold"
                style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
              >
                Dashboard
              </Link>
              <span
                className="hidden sm:inline-flex w-8 h-8 items-center justify-center text-sm font-semibold"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
                title={user.name}
              >
                {user.name.charAt(0)}
              </span>
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={signingIn}
                className="px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ background: COLORS.text, color: "#fff", borderRadius: RADIUS.pill }}
              >
                {signingIn ? "Signing in…" : "Sign in"}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div
                    className="absolute right-0 top-full mt-2 z-[110] py-2 min-w-[260px] shadow-lg"
                    style={{ background: COLORS.surface, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}
                  >
                    {useFirebase ? (
                      <div className="px-3 py-2 space-y-2">
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold"
                          style={{ background: COLORS.subtle, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}
                        >
                          Continue with Google
                        </button>
                        <p style={{ ...F.body, fontSize: 11, color: COLORS.muted, textAlign: "center" }}>
                          @{ALLOWED_EMAIL_DOMAIN} only
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: COLORS.border }}>
                        {MOCK_USERS.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => enterAs(u.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                          >
                            <span
                              className="w-8 h-8 flex items-center justify-center text-xs font-semibold shrink-0"
                              style={{
                                background: u.role === "internal" ? "rgba(41,130,204,0.12)" : COLORS.accentSoft,
                                color: u.role === "internal" ? "#2982cc" : COLORS.accent,
                                borderRadius: "50%",
                              }}
                            >
                              {u.name.charAt(0)}
                            </span>
                            <span style={{ ...F.body, fontSize: 14, fontWeight: 500, color: COLORS.text }}>{u.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        className="md:hidden flex gap-1 px-4 pb-3 overflow-x-auto"
        aria-label="Community board"
      >
        {HUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0"
            style={{
              borderRadius: RADIUS.pill,
              background: tab === t.id ? COLORS.surface : COLORS.subtle,
              color: tab === t.id ? COLORS.text : COLORS.muted,
              border: `1px solid ${tab === t.id ? COLORS.border : "transparent"}`,
              ...F.body,
            }}
          >
            {t.label}
            {counts[t.id] > 0 && ` (${counts[t.id]})`}
          </button>
        ))}
      </nav>

      {authError && !user && (
        <p className="max-w-5xl mx-auto px-6 pb-3 text-sm" style={{ ...F.body, color: "#FF3B30" }}>
          {authError}
        </p>
      )}
    </header>
  );
}
