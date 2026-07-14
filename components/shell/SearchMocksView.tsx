"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { filterHistoryGroups } from "@lib/utils/session-history";
import type { TicketHistoryGroup } from "@lib/utils/session-history";
import { listDateLabel } from "@lib/utils/review-ui";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { BuildingStatusLabel } from "@/components/shared/BuildingStatusLabel";

export function SearchMocksView({
  groups,
  loading,
}: {
  groups: TicketHistoryGroup[];
  loading: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(
    () => filterHistoryGroups(groups, query),
    [groups, query],
  );

  const showRecentLabel = !query.trim();

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center overflow-hidden relative">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 18%, rgba(217,119,6,0.06) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[720px] flex-1 min-h-0 flex flex-col px-6 pt-6 sm:pt-10 pb-8">
        <div
          className="flex-none flex items-center gap-3 w-full pl-4 pr-3 py-2.5 mb-8 sm:mb-10"
          style={{
            background: COLORS.surface,
            borderRadius: RADIUS.pill,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
            minHeight: 52,
          }}
        >
          <span
            className="flex-none flex items-center justify-center"
            style={{ color: COLORS.muted, fontSize: 18, lineHeight: 1 }}
            aria-hidden
          >
            ⌕
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search mocks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent outline-none text-base py-1.5"
            style={{
              ...F.body,
              color: COLORS.text,
              caretColor: COLORS.accent,
              fontSize: 16,
            }}
            aria-label="Search mocks"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex-none w-8 h-8 flex items-center justify-center hover:bg-black/5 transition-colors"
              style={{ borderRadius: "50%", color: COLORS.muted, fontSize: 18 }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="signal-bars">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : results.length === 0 ? (
            <p className="text-center py-16" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
              {query.trim() ? "No mocks match your search" : "No mocks yet"}
            </p>
          ) : (
            <>
              {showRecentLabel && (
                <div
                  className="px-3 mb-2"
                  style={{
                    ...F.body,
                    fontSize: 13,
                    fontWeight: 500,
                    color: COLORS.muted,
                  }}
                >
                  Recent
                </div>
              )}
              <ul className="space-y-0.5">
                {results.map((group) => (
                  <li key={group.ticketId}>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/workspace/${encodeURIComponent(group.ticketId)}`)
                      }
                      className="w-full flex items-start gap-4 px-3 py-3 text-left transition-colors hover:bg-black/[0.05]"
                      style={{ borderRadius: 12 }}
                    >
                      <span
                        className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                        style={{
                          ...F.body,
                          fontSize: 15,
                          color: COLORS.text,
                          fontWeight: 450,
                          letterSpacing: "-0.01em",
                          lineHeight: 1.35,
                        }}
                      >
                        <span
                          className="min-w-0"
                          style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                        >
                          {group.summary || group.ticketId}
                        </span>
                        {group.building && <BuildingStatusLabel />}
                      </span>
                      <span
                        className="flex-none tabular-nums pt-0.5"
                        style={{ ...F.body, fontSize: 13, color: COLORS.muted }}
                      >
                        {listDateLabel(group.savedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
