"use client";

import { useEffect, useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { EngagementType, UserEngagement } from "@lib/types";
import { repository, generateId } from "@lib/storage";
import { useAuth } from "@lib/auth/auth-context";

const DASHBOARD_TICKET = "GENERAL";

export function DashboardEngagementPanel() {
  const { user } = useAuth();
  const [existing, setExisting] = useState<UserEngagement[]>([]);
  const [activeForm, setActiveForm] = useState<EngagementType | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user || user.role !== "external") return;
    repository.getEngagement({ userId: user.id }).then((items) => {
      setExisting(items.filter((e) => e.ticketId === DASHBOARD_TICKET || !e.ticketId));
    });
  }, [user]);

  if (!user || user.role !== "external") return null;

  const hasType = (type: EngagementType) =>
    existing.some((e) => e.type === type && (e.ticketId === DASHBOARD_TICKET || e.sessionId.startsWith("dashboard-")));

  async function submit(type: EngagementType) {
    const item: UserEngagement = {
      id: generateId(),
      userId: user!.id,
      sessionId: `dashboard-${user!.id}`,
      ticketId: DASHBOARD_TICKET,
      type,
      createdAt: Date.now(),
    };

    if (type === "testimonial") {
      if (!text.trim()) return;
      item.text = text.trim();
      item.showName = true;
    } else {
      if (!title.trim()) return;
      item.title = title.trim();
      item.description = description.trim() || undefined;
      item.requestStatus = "submitted";
    }

    await repository.saveEngagement(item);
    setExisting((prev) => [...prev, item]);
    setActiveForm(null);
    setText("");
    setTitle("");
    setDescription("");
    setToast(type === "testimonial" ? "Thanks for sharing!" : "Feature idea received!");
    setTimeout(() => setToast(""), 2500);
  }

  if (hasType("testimonial") && hasType("feature_request") && !activeForm) {
    return (
      <p className="text-center" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
        Thanks for your feedback — we appreciate it.
      </p>
    );
  }

  return (
    <div
      className="p-5 space-y-4"
      style={{
        background: COLORS.surface,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="text-center space-y-1">
        <p style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>Share with us</p>
        <p style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
          Leave a testimonial or suggest a feature for GCC Studio
        </p>
      </div>

      {toast && (
        <p className="text-center text-sm font-medium" style={{ color: "#34C759" }}>{toast}</p>
      )}

      {!activeForm ? (
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {!hasType("testimonial") && (
            <button
              type="button"
              onClick={() => setActiveForm("testimonial")}
              className="flex-1 px-4 py-3 text-sm font-semibold transition-transform active:scale-[0.98]"
              style={{ background: COLORS.subtle, color: COLORS.text, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}
            >
              ✦ Leave a testimonial
            </button>
          )}
          {!hasType("feature_request") && (
            <button
              type="button"
              onClick={() => setActiveForm("feature_request")}
              className="flex-1 px-4 py-3 text-sm font-semibold transition-transform active:scale-[0.98]"
              style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: RADIUS.md, border: `1px solid rgba(217,119,6,0.2)` }}
            >
              ◇ Suggest a feature
            </button>
          )}
        </div>
      ) : activeForm === "testimonial" ? (
        <div className="space-y-3">
          <textarea
            rows={3}
            maxLength={280}
            placeholder="What do you love about GCC Studio?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-amber-500/20"
            style={{ background: COLORS.subtle, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, ...F.body }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setActiveForm(null)} className="flex-1 py-2.5 text-sm" style={{ color: COLORS.muted, ...F.body }}>Cancel</button>
            <button
              type="button"
              onClick={() => submit("testimonial")}
              disabled={!text.trim()}
              className="flex-1 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
            >
              Submit
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Feature title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
            style={{ background: COLORS.subtle, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, ...F.body }}
          />
          <textarea
            rows={3}
            placeholder="Describe the feature…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-amber-500/20"
            style={{ background: COLORS.subtle, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, ...F.body }}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setActiveForm(null)} className="flex-1 py-2.5 text-sm" style={{ color: COLORS.muted, ...F.body }}>Cancel</button>
            <button
              type="button"
              onClick={() => submit("feature_request")}
              disabled={!title.trim()}
              className="flex-1 py-2.5 text-sm font-semibold disabled:opacity-40"
              style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
