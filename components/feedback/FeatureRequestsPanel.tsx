"use client";

import { useEffect, useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { UserEngagement } from "@lib/types";
import { repository } from "@lib/storage";
import { getMockUser } from "@lib/auth/mock-users";

function submitterName(userId: string): string {
  return getMockUser(userId)?.name ?? "External PM";
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FeatureRequestsPanel({ compact }: { compact?: boolean }) {
  const [requests, setRequests] = useState<UserEngagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    repository.getEngagement({ type: "feature_request" }).then((items) => {
      setRequests(items);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  if (requests.length === 0) {
    return (
      <div
        className="p-5 text-center"
        style={{
          background: COLORS.surface,
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
          No feature requests yet
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 style={{ ...F.body, fontSize: compact ? 16 : 20, fontWeight: 600, color: COLORS.text }}>
          Feature requests
          <span className="ml-2 font-normal" style={{ fontSize: compact ? 13 : 14, color: COLORS.muted }}>
            ({requests.length})
          </span>
        </h2>
        {!compact && (
          <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
            Ideas submitted by product managers
          </p>
        )}
      </div>

      <div
        className="overflow-hidden divide-y"
        style={{
          background: COLORS.surface,
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        {requests.map((req) => (
          <article key={req.id} className="px-5 py-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
                {req.title}
              </h3>
              <span
                className="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: RADIUS.pill }}
              >
                New
              </span>
            </div>
            {req.description && (
              <p style={{ ...F.body, fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>
                {req.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-xs" style={{ ...F.body, color: COLORS.muted }}>
              <span>{submitterName(req.userId)}</span>
              <span>·</span>
              <span>{formatDate(req.createdAt)}</span>
              {req.ticketId && req.ticketId !== "GENERAL" && (
                <>
                  <span>·</span>
                  <span style={{ ...F.mono, color: COLORS.accent }}>{req.ticketId}</span>
                </>
              )}
              {req.ticketId === "GENERAL" && (
                <>
                  <span>·</span>
                  <span>Product feedback</span>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
