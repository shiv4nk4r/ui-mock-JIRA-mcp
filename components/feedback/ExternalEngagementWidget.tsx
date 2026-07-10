"use client";

import { useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { UserEngagement } from "@lib/types";
import { repository, generateId } from "@lib/storage";
import { useAuth } from "@lib/auth/auth-context";

interface Props {
  sessionId: string;
  ticketId: string;
  existing: UserEngagement[];
  onSubmitted: () => void;
}

export function ExternalEngagementWidget({ sessionId, ticketId, existing, onSubmitted }: Props) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.role !== "external" || dismissed) return null;
  if (existing.some((e) => e.type === "feedback")) return null;

  async function quickFeedback(r: "positive" | "negative") {
    if (!user) return;
    await repository.saveEngagement({
      id: generateId(),
      userId: user.id,
      sessionId,
      ticketId,
      type: "feedback",
      rating: r,
      createdAt: Date.now(),
    });
    onSubmitted();
    setDismissed(true);
  }

  return (
    <div className="py-3 px-1" style={{ animation: "fade-in-up 0.3s ease" }}>
      <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, textAlign: "center" }}>Helpful?</p>
      <div className="flex justify-center gap-2 mt-2">
        <button type="button" onClick={() => quickFeedback("positive")} className="px-4 py-2 text-lg" style={{ background: COLORS.subtle, borderRadius: RADIUS.pill }}>👍</button>
        <button type="button" onClick={() => quickFeedback("negative")} className="px-4 py-2 text-lg" style={{ background: COLORS.subtle, borderRadius: RADIUS.pill }}>👎</button>
        <button type="button" onClick={() => setDismissed(true)} className="px-2 py-1.5 text-xs" style={{ color: COLORS.muted }}>Dismiss</button>
      </div>
    </div>
  );
}
