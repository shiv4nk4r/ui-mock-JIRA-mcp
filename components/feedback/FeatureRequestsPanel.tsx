"use client";

import { useEffect, useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { FeatureRequestStatus, UserEngagement } from "@lib/types";
import { repository } from "@lib/storage";
import { getMockUser } from "@lib/auth/mock-users";
import { useAuth } from "@lib/auth/auth-context";
import {
  FEATURE_REQUEST_LABELS,
  FEATURE_REQUEST_STATUSES,
  FeatureRequestStatusChip,
} from "@lib/utils/feature-request-status";
import { relativeTime } from "@lib/utils/review-ui";

function submitterName(userId: string): string {
  return getMockUser(userId)?.name ?? "Product team";
}

export function FeatureRequestsPanel({ compact, manageable }: { compact?: boolean; manageable?: boolean }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<UserEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = manageable && user?.role === "internal";

  useEffect(() => {
    repository.getEngagement({ type: "feature_request" }).then((items) => {
      setRequests(items);
      setLoading(false);
    });
  }, []);

  async function updateStatus(id: string, requestStatus: FeatureRequestStatus) {
    await repository.updateEngagement(id, { requestStatus });
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, requestStatus } : r)));
  }

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
            {canManage ? "Update status as ideas move through the pipeline" : "Ideas submitted by product teams"}
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
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h3 style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
                {req.title}
              </h3>
              {canManage ? (
                <select
                  value={req.requestStatus ?? "submitted"}
                  onChange={(e) => updateStatus(req.id, e.target.value as FeatureRequestStatus)}
                  className="text-xs font-medium px-2 py-1 outline-none shrink-0"
                  style={{ borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, ...F.body, color: COLORS.text }}
                >
                  {FEATURE_REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>{FEATURE_REQUEST_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <FeatureRequestStatusChip status={req.requestStatus} />
              )}
            </div>
            {req.description && (
              <p style={{ ...F.body, fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>
                {req.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap text-xs" style={{ ...F.body, color: COLORS.muted }}>
              <span>{submitterName(req.userId)}</span>
              <span>·</span>
              <span>{relativeTime(req.createdAt)}</span>
              {req.ticketId && req.ticketId !== "GENERAL" && (
                <>
                  <span>·</span>
                  <span style={{ ...F.mono, color: COLORS.accent }}>{req.ticketId}</span>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
