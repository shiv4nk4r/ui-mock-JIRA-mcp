"use client";

import { useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { UserEngagement } from "@lib/types";
import { repository, generateId } from "@lib/storage";
import { useAuth } from "@lib/auth/auth-context";

interface Props {
  sessionId: string;
  ticketId: string;
  messageIndex: number;
  existing?: UserEngagement;
  onSubmitted: () => void;
}

export function InternalFeedbackWidget({ sessionId, ticketId, messageIndex, existing, onSubmitted }: Props) {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(!!existing);

  if (!user || user.role !== "internal" || submitted) return null;

  async function submit(r: "positive" | "negative") {
    if (!user) return;
    await repository.saveEngagement({
      id: generateId(),
      userId: user.id,
      sessionId: `${sessionId}-msg-${messageIndex}`,
      ticketId,
      type: "feedback",
      rating: r,
      createdAt: Date.now(),
    });
    setSubmitted(true);
    onSubmitted();
  }

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>Helpful?</span>
      <button type="button" onClick={() => submit("positive")} className="px-3 py-1.5" style={{ background: COLORS.subtle, borderRadius: RADIUS.pill }}>👍</button>
      <button type="button" onClick={() => submit("negative")} className="px-3 py-1.5" style={{ background: COLORS.subtle, borderRadius: RADIUS.pill }}>👎</button>
    </div>
  );
}

export function EngagementSummary({ items }: { items: UserEngagement[] }) {
  if (!items.length) return null;
  return (
    <div className="p-4 space-y-3" style={{ background: COLORS.subtle, borderRadius: RADIUS.md }}>
      <div style={{ ...F.body, fontSize: 14, fontWeight: 600, color: COLORS.text }}>PM feedback</div>
      {items.map((e) => (
        <div key={e.id} className="text-sm">
          <span style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.accent, textTransform: "capitalize" }}>
            {e.type.replace("_", " ")}
          </span>
          {e.rating && <span className="ml-2">{e.rating === "positive" ? "👍" : "👎"}</span>}
          {e.text && <p style={{ ...F.body, fontSize: 13, color: COLORS.text, marginTop: 4 }}>{e.text}</p>}
          {e.title && <p style={{ ...F.body, fontSize: 13, fontWeight: 600 }}>{e.title}</p>}
          {e.description && <p style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>{e.description}</p>}
        </div>
      ))}
    </div>
  );
}
