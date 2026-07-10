"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import { fetchReviewsForNav } from "@lib/utils/review-notifications";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();
  const [reviewCount, setReviewCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchReviewsForNav(user.id, user.role, (filter) => repository.getReviews(filter)).then(setReviewCount);
  }, [user, pathname]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  const inWorkspace = pathname.startsWith("/workspace/");

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: COLORS.bg }}>
      {!inWorkspace && (
        <header
          className="w-full flex-none flex items-center justify-between px-6 py-3"
          style={{ background: "rgba(245,245,247,0.85)", backdropFilter: "blur(12px)" }}
        >
          <Link href="/dashboard" className="shrink-0" style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.02em" }}>
            Mock Studio
          </Link>

          <nav className="flex items-center gap-1 p-1 max-w-[calc(100vw-8rem)] overflow-x-auto" style={{ background: COLORS.subtle, borderRadius: RADIUS.pill }}>
            <Link
              href="/dashboard"
              className="px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderRadius: RADIUS.pill,
                background: pathname === "/dashboard" ? COLORS.surface : "transparent",
                color: pathname === "/dashboard" ? COLORS.text : COLORS.muted,
                boxShadow: pathname === "/dashboard" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Home
            </Link>
            <Link
              href="/history"
              className="px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderRadius: RADIUS.pill,
                background: pathname === "/history" ? COLORS.surface : "transparent",
                color: pathname === "/history" ? COLORS.text : COLORS.muted,
                boxShadow: pathname === "/history" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              History
            </Link>
            {user.role === "internal" && (
              <Link
                href="/mockups"
                className="px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  borderRadius: RADIUS.pill,
                  background: pathname.startsWith("/mockups") || pathname.startsWith("/generate") ? COLORS.surface : "transparent",
                  color: pathname.startsWith("/mockups") || pathname.startsWith("/generate") ? COLORS.text : COLORS.muted,
                  boxShadow: pathname.startsWith("/mockups") || pathname.startsWith("/generate") ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Gallery
              </Link>
            )}
            <Link
              href="/reviews"
              className="px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5"
              style={{
                borderRadius: RADIUS.pill,
                background: pathname.startsWith("/reviews") ? COLORS.surface : "transparent",
                color: pathname.startsWith("/reviews") ? COLORS.text : COLORS.muted,
                boxShadow: pathname.startsWith("/reviews") ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              Reviews
              {reviewCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: COLORS.accent, borderRadius: RADIUS.pill }}>
                  {reviewCount}
                </span>
              )}
            </Link>
          </nav>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 transition-colors"
              style={{ borderRadius: RADIUS.pill, background: menuOpen ? COLORS.subtle : "transparent" }}
            >
              <span
                className="w-8 h-8 flex items-center justify-center text-sm font-semibold"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
              >
                {user.name.charAt(0)}
              </span>
              <span className="hidden md:inline text-sm font-medium" style={{ color: COLORS.text }}>{user.name.split(" ")[0]}</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
                <div
                  className="absolute right-0 top-full mt-2 z-50 py-2 min-w-[180px] shadow-lg"
                  style={{ background: COLORS.surface, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}
                >
                  <div className="px-4 py-2 border-b text-xs" style={{ borderColor: COLORS.border, color: COLORS.muted }}>
                    {user.email}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); signOut(); router.push("/login"); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                    style={{ ...F.body, color: COLORS.text }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
      )}
      <main className="flex-1 w-full">{children}</main>
    </div>
  );
}
