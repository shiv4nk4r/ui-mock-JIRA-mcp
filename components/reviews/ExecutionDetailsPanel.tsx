"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionDetails } from "@lib/utils/execution-details";
import { buildAgentPrompt } from "@lib/utils/execution-details";
import type { MockupSession, ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { EffortMarkdown } from "@/components/chat/ChatMarkdown";

const SOURCE_LABELS: Record<ExecutionDetails["changes"][0]["source"], string> = {
  effort: "Engineering estimate",
  revision: "PM revision",
  ticket: "Ticket scope",
};

interface Props {
  review: ReviewItem;
  session: MockupSession | null;
  details: ExecutionDetails;
  effortMarkdown?: string;
  embedded?: boolean;
}

export function ExecutionDetailsPanel({ review, session, details, effortMarkdown, embedded }: Props) {
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generatePrompt = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/execution-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review,
          session,
          fallbackPrompt: buildAgentPrompt(details, review, session),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { prompt: string };
        setPrompt(data.prompt);
      } else {
        setPrompt(buildAgentPrompt(details, review, session));
      }
    } catch {
      setPrompt(buildAgentPrompt(details, review, session));
    } finally {
      setGenerating(false);
    }
  }, [details, review, session]);

  useEffect(() => {
    setPrompt(buildAgentPrompt(details, review, session));
  }, [details, review, session]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <section
      className="space-y-5 p-5 sm:p-6"
      style={
        embedded
          ? undefined
          : {
              background: COLORS.surface,
              borderRadius: RADIUS.lg,
              border: `1px solid ${COLORS.border}`,
            }
      }
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 style={{ ...F.body, fontSize: 20, fontWeight: 600, color: COLORS.text }}>
            Execution details
          </h2>
          <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
            What to change, where it applies, and a ready-to-paste agent prompt
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {details.tshirtSize && (
            <Chip label="Size" value={details.tshirtSize} />
          )}
          {details.storyPoints && (
            <Chip label="Points" value={details.storyPoints} />
          )}
          {details.riskFactor && (
            <Chip label="Risk" value={details.riskFactor.split("—")[0].trim()} />
          )}
        </div>
      </div>

      {details.changes.length === 0 ? (
        <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
          No structured breakdown yet — open the workspace to generate effort estimation, or use the prompt below from ticket scope.
        </p>
      ) : (
        <div className="space-y-3">
          {details.changes.map((change, idx) => (
            <div
              key={change.id}
              className="flex gap-4 p-4"
              style={{ background: COLORS.subtle, borderRadius: RADIUS.md, borderLeft: `3px solid ${COLORS.accent}` }}
            >
              <span
                className="shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
              >
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ ...F.mono, fontSize: 13, fontWeight: 600, color: COLORS.accent }}>
                    {change.location}
                  </span>
                  {change.effort && (
                    <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>{change.effort}</span>
                  )}
                  <span
                    className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: COLORS.surface, color: COLORS.muted, borderRadius: RADIUS.pill }}
                  >
                    {SOURCE_LABELS[change.source]}
                  </span>
                </div>
                <p style={{ ...F.body, fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>
                  {change.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {effortMarkdown && (
        <details className="group">
          <summary
            className="cursor-pointer text-sm font-medium"
            style={{ ...F.body, color: COLORS.muted }}
          >
            Full effort estimation
          </summary>
          <div className="mt-3 p-4" style={{ background: COLORS.subtle, borderRadius: RADIUS.md }}>
            <EffortMarkdown text={effortMarkdown} />
          </div>
        </details>
      )}

      <div className="space-y-3 pt-2 border-t" style={{ borderColor: COLORS.border }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
            AI agent prompt
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={generatePrompt}
              disabled={generating}
              className="px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: COLORS.subtle, color: COLORS.text, borderRadius: RADIUS.pill, border: `1px solid ${COLORS.border}` }}
            >
              {generating ? "Generating…" : "Regenerate prompt"}
            </button>
            <button
              type="button"
              onClick={copyPrompt}
              className="px-4 py-2 text-sm font-semibold"
              style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
            >
              {copied ? "Copied!" : "Copy prompt"}
            </button>
          </div>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={16}
          className="w-full px-4 py-3 text-sm outline-none resize-y font-mono"
          style={{
            background: COLORS.subtle,
            color: COLORS.text,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
            lineHeight: 1.55,
          }}
          spellCheck={false}
        />
        <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
          Paste into Cursor, Claude Code, or your coding agent. Edit before sending if needed.
        </p>
      </div>
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
      style={{ background: COLORS.subtle, borderRadius: RADIUS.pill, border: `1px solid ${COLORS.border}` }}
    >
      <span style={{ ...F.body, color: COLORS.muted }}>{label}</span>
      <span style={{ ...F.body, fontWeight: 600, color: COLORS.text }}>{value}</span>
    </span>
  );
}
