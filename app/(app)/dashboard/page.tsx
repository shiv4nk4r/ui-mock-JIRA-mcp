"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { F, COLORS, RADIUS, pickGreeting } from "@lib/design/tokens";
import { useHomeChrome } from "@/components/shell/HomeChromeFrame";
import { DashboardEngagementPanel } from "@/components/feedback/DashboardEngagementPanel";
import { FeatureRequestsPanel } from "@/components/feedback/FeatureRequestsPanel";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { groups, loading, newMockNonce } = useHomeChrome();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ticketInput, setTicketInput] = useState("");
  const [headline, setHeadline] = useState("Welcome");

  useEffect(() => {
    if (user) setHeadline(pickGreeting(user.name));
  }, [user]);

  useEffect(() => {
    if (!authLoading && !loading) inputRef.current?.focus();
  }, [authLoading, loading]);

  useEffect(() => {
    if (!newMockNonce) return;
    setTicketInput("");
    inputRef.current?.focus();
  }, [newMockNonce]);

  function goToTicket(id: string) {
    router.push(`/workspace/${encodeURIComponent(id.trim().toUpperCase())}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ticketInput.trim()) return;
    goToTicket(ticketInput);
  }

  const recent = groups.find((g) => !g.building) ?? groups[0] ?? null;

  return (
    <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 42%, rgba(217,119,6,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16 sm:pb-24">
        <div className="w-full max-w-[720px] flex flex-col items-center">
          <h1
            className="text-center mb-10 sm:mb-12"
            style={{
              ...F.body,
              fontSize: "clamp(28px, 4.5vw, 44px)",
              fontWeight: 500,
              color: COLORS.text,
              letterSpacing: "-0.035em",
              lineHeight: 1.15,
            }}
          >
            {headline}
          </h1>

          <form onSubmit={handleSubmit} className="w-full relative">
            <div
              className="flex items-center gap-2 w-full pl-4 pr-2 py-2 transition-shadow focus-within:ring-2 focus-within:ring-amber-500/20"
              style={{
                background: COLORS.surface,
                borderRadius: RADIUS.pill,
                border: `1px solid ${COLORS.border}`,
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                minHeight: 56,
              }}
            >
              <span
                className="flex-none w-9 h-9 flex items-center justify-center rounded-full"
                style={{ color: COLORS.muted, fontSize: 20 }}
                aria-hidden
              >
                +
              </span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask for a mockup — paste a JIRA ticket"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none text-base py-2"
                style={{
                  ...F.body,
                  color: COLORS.text,
                  caretColor: COLORS.accent,
                  fontSize: 16,
                }}
              />
              <button
                type="submit"
                disabled={!ticketInput.trim()}
                className="flex-none px-5 py-2.5 text-sm font-semibold disabled:opacity-35 transition-opacity"
                style={{
                  background: COLORS.accent,
                  color: "#fff",
                  borderRadius: RADIUS.pill,
                }}
              >
                Go
              </button>
            </div>
          </form>

          {!loading && recent && (
            <button
              type="button"
              onClick={() => goToTicket(recent.ticketId)}
              className="mt-6 text-sm hover:underline"
              style={{ ...F.body, color: COLORS.muted }}
            >
              Continue {recent.ticketId}
            </button>
          )}
        </div>
      </div>

      {(user?.role === "external" || user?.role === "internal") && !loading && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-4 pointer-events-none max-h-[28vh] overflow-y-auto">
          <div className="max-w-[720px] mx-auto pointer-events-auto opacity-75">
            {user.role === "external" && <DashboardEngagementPanel />}
            {user.role === "internal" && <FeatureRequestsPanel manageable />}
          </div>
        </div>
      )}
    </div>
  );
}
