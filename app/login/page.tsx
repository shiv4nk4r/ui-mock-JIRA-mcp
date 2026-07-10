"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { MOCK_USERS } from "@lib/auth/mock-users";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

export default function LoginPage() {
  const router = useRouter();
  const { signInWithMockUser, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [isLoading, user, router]);

  function enterAs(userId: string) {
    signInWithMockUser(userId);
    router.push("/dashboard");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: COLORS.bg }}
    >
      <div className="w-full max-w-sm text-center space-y-10">
        <div className="space-y-2">
          <div
            className="mx-auto w-14 h-14 flex items-center justify-center text-2xl font-semibold"
            style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: RADIUS.lg }}
          >
            M
          </div>
          <h1 style={{ ...F.body, fontSize: 28, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.02em" }}>
            Mock Studio
          </h1>
          <p style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>
            Turn JIRA tickets into UI mockups. Tap your profile to begin.
          </p>
        </div>

        <div className="space-y-3">
          {MOCK_USERS.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => enterAs(u.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-transform active:scale-[0.98]"
              style={{
                background: COLORS.surface,
                borderRadius: RADIUS.lg,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                className="w-11 h-11 flex items-center justify-center text-base font-semibold shrink-0"
                style={{
                  background: u.role === "internal" ? "rgba(41,130,204,0.12)" : COLORS.accentSoft,
                  color: u.role === "internal" ? "#2982cc" : COLORS.accent,
                  borderRadius: "50%",
                }}
              >
                {u.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>{u.name}</div>
                <div style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
                  {u.role === "internal" ? "Engineering · Reviews & technical details" : "Product · Mockups & sharing"}
                </div>
              </div>
              <span style={{ ...F.body, fontSize: 18, color: COLORS.muted }}>›</span>
            </button>
          ))}
        </div>

        <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
          Demo sign-in · Google SSO coming soon
        </p>
      </div>
    </div>
  );
}
