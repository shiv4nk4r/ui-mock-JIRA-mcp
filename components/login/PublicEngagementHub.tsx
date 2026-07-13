"use client";

import { useEffect, useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { FeatureRequestStatus, UserEngagement } from "@lib/types";
import { repository } from "@lib/storage";
import { getMockUser } from "@lib/auth/mock-users";
import {
  FEATURE_REQUEST_LABELS,
  FEATURE_REQUEST_STATUSES,
  FeatureRequestStatusChip,
} from "@lib/utils/feature-request-status";
import { relativeTime } from "@lib/utils/review-ui";
import { useAuth } from "@lib/auth/auth-context";
import { useHub } from "@/components/login/HubContext";

function submitterName(userId: string): string {
  return getMockUser(userId)?.name ?? "Product team";
}

function SignInPrompt({ action }: { action: string }) {
  return (
    <div
      className="px-5 py-4 text-center"
      style={{ background: COLORS.subtle, borderRadius: RADIUS.md, border: `1px dashed ${COLORS.border}` }}
    >
      <p style={{ ...F.body, fontSize: 14, color: COLORS.text }}>
        Sign in to {action}
      </p>
      <p style={{ ...F.body, fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
        Use <strong>Sign in</strong> in the header
      </p>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center px-6">
      <p style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>{label}</p>
    </div>
  );
}

const TAB_COPY: Record<string, { title: string; subtitle: string; empty: string; signIn: string }> = {
  features: {
    title: "Feature requests",
    subtitle: "Ideas from product teams — track status as they move through the pipeline",
    empty: "No feature requests yet — sign in to suggest the first one",
    signIn: "suggest a feature",
  },
  testimonials: {
    title: "Testimonials",
    subtitle: "What teams are saying about GCC Studio",
    empty: "No testimonials yet",
    signIn: "leave a testimonial",
  },
  feedback: {
    title: "Recent feedback",
    subtitle: "Quick ratings from mockup sessions",
    empty: "No session feedback yet",
    signIn: "rate a mockup session",
  },
};

export function PublicEngagementHub() {
  const { user } = useAuth();
  const { tab, refreshCounts } = useHub();
  const [features, setFeatures] = useState<UserEngagement[]>([]);
  const [testimonials, setTestimonials] = useState<UserEngagement[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserEngagement[]>([]);
  const [loading, setLoading] = useState(true);

  const isInternal = user?.role === "internal";
  const copy = TAB_COPY[tab];

  async function loadAll() {
    const [f, t, b] = await Promise.all([
      repository.getEngagement({ type: "feature_request" }),
      repository.getEngagement({ type: "testimonial" }),
      repository.getEngagement({ type: "feedback" }),
    ]);
    setFeatures(f);
    setTestimonials(t);
    setFeedbacks(b);
    setLoading(false);
    refreshCounts();
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function updateFeatureStatus(id: string, requestStatus: FeatureRequestStatus) {
    await repository.updateEngagement(id, { requestStatus });
    setFeatures((prev) => prev.map((r) => (r.id === id ? { ...r, requestStatus } : r)));
  }

  return (
    <section id="community-board" className="space-y-4 scroll-mt-24">
      <div>
        <p style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Community board
        </p>
        <h2 style={{ ...F.body, fontSize: 22, fontWeight: 600, color: COLORS.text, marginTop: 4 }}>
          {copy.title}
        </h2>
        <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
          {copy.subtitle}
        </p>
      </div>

      <div
        style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, minHeight: 280 }}
      >
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="signal-bars"><span /><span /><span /><span /><span /></div>
          </div>
        ) : tab === "features" ? (
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {features.length === 0 ? (
              <EmptyState label={copy.empty} />
            ) : (
              features.map((req) => (
                <article key={req.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h3 style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>{req.title}</h3>
                    {isInternal ? (
                      <select
                        value={req.requestStatus ?? "submitted"}
                        onChange={(e) => updateFeatureStatus(req.id, e.target.value as FeatureRequestStatus)}
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
                    <p style={{ ...F.body, fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>{req.description}</p>
                  )}
                  <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
                    {submitterName(req.userId)} · {relativeTime(req.createdAt)}
                    {req.ticketId && req.ticketId !== "GENERAL" && (
                      <> · <span style={{ ...F.mono, color: COLORS.accent }}>{req.ticketId}</span></>
                    )}
                  </p>
                </article>
              ))
            )}
            {!user && (
              <div className="p-5">
                <SignInPrompt action={copy.signIn} />
              </div>
            )}
          </div>
        ) : tab === "testimonials" ? (
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {testimonials.length === 0 ? (
              <EmptyState label={copy.empty} />
            ) : (
              testimonials.map((t) => (
                <blockquote key={t.id} className="px-5 py-4 space-y-2">
                  <p style={{ ...F.body, fontSize: 15, color: COLORS.text, lineHeight: 1.6, fontStyle: "italic" }}>
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <footer style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
                    {t.showName !== false ? submitterName(t.userId) : "Anonymous"} · {relativeTime(t.createdAt)}
                  </footer>
                </blockquote>
              ))
            )}
            {!user && (
              <div className="p-5">
                <SignInPrompt action={copy.signIn} />
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {feedbacks.length === 0 ? (
              <EmptyState label={copy.empty} />
            ) : (
              feedbacks.map((f) => (
                <div key={f.id} className="px-5 py-4 flex items-start gap-3">
                  <span className="text-xl shrink-0">{f.rating === "positive" ? "👍" : "👎"}</span>
                  <div className="min-w-0">
                    <p style={{ ...F.body, fontSize: 14, fontWeight: 500, color: COLORS.text }}>
                      {f.rating === "positive" ? "Helpful mockup session" : "Mockup needs improvement"}
                    </p>
                    <p style={{ ...F.body, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                      {submitterName(f.userId)} · {relativeTime(f.createdAt)}
                      {f.ticketId && f.ticketId !== "GENERAL" && (
                        <> · <span style={{ ...F.mono, color: COLORS.accent }}>{f.ticketId}</span></>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
            {!user && (
              <div className="p-5">
                <SignInPrompt action={copy.signIn} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
