"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionDetails } from "@lib/utils/execution-details";
import { buildAgentPrompt } from "@lib/utils/execution-details";
import type { MockupSession, ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { EffortMarkdown } from "@/components/chat/ChatMarkdown";
import { ChangesByFileTable } from "@/components/reviews/ChangesByFileTable";

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
    setPrompt(details.generatedAgentPrompt ?? buildAgentPrompt(details, review, session));
  }, [details, review, session]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const chips = (
    <div className="flex flex-wrap gap-1.5">
      {details.tshirtSize && <Chip label="Size" value={details.tshirtSize} />}
      {details.storyPoints && <Chip label="Points" value={details.storyPoints} />}
      {details.riskFactor && <Chip label="Risk" value={details.riskFactor.split("—")[0].trim()} />}
    </div>
  );

  return (
    <section
      className={embedded ? "space-y-6 px-6 py-5" : "space-y-5 p-5 sm:p-6"}
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
      {!embedded && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 style={{ ...F.body, fontSize: 20, fontWeight: 560, color: COLORS.text, letterSpacing: "-0.02em" }}>
              Execution details
            </h2>
            <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
              What to change, where it applies, and a ready-to-paste agent prompt
            </p>
          </div>
          {chips}
        </div>
      )}

      {embedded && chips}

      <div className="space-y-2">
        <p style={{ ...F.body, fontSize: 12, fontWeight: 520, color: COLORS.muted }}>
          Changes by file
        </p>
        <ChangesByFileTable details={details} />
      </div>

      {details.changeLogMarkdown && (
        <details>
          <summary
            className="cursor-pointer text-sm"
            style={{ ...F.body, color: COLORS.muted, fontWeight: 450 }}
          >
            Full implementation change log
          </summary>
          <div className="mt-2 p-3.5 overflow-x-auto" style={{ background: COLORS.subtle, borderRadius: RADIUS.md }}>
            <EffortMarkdown text={details.changeLogMarkdown} />
          </div>
        </details>
      )}

      {effortMarkdown && (
        <details>
          <summary
            className="cursor-pointer text-sm"
            style={{ ...F.body, color: COLORS.muted, fontWeight: 450 }}
          >
            Full effort estimation
          </summary>
          <div className="mt-2 p-3.5" style={{ background: COLORS.subtle, borderRadius: RADIUS.md }}>
            <EffortMarkdown text={effortMarkdown} />
          </div>
        </details>
      )}

      <details
        className="group pt-5"
        style={{ borderTop: `1px solid ${COLORS.border}` }}
      >
        <summary
          className="cursor-pointer list-none flex items-center justify-between gap-3 flex-wrap py-1 [&::-webkit-details-marker]:hidden"
          style={{ ...F.body }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="shrink-0 transition-transform group-open:rotate-90"
              style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1 }}
              aria-hidden
            >
              ▸
            </span>
            <div>
              <p style={{ ...F.body, fontSize: 15, fontWeight: 560, color: COLORS.text }}>
                Agent prompt
              </p>
              <p style={{ ...F.body, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                Expand to view or edit · paste into Cursor or Claude Code
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copyPrompt();
            }}
            className="px-3.5 py-2 text-sm font-semibold shrink-0"
            style={{
              ...F.body,
              background: COLORS.accent,
              color: "#fff",
              borderRadius: RADIUS.pill,
              boxShadow: "0 4px 14px rgba(217,119,6,0.28)",
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </summary>

        <div className="space-y-3 mt-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={generatePrompt}
              disabled={generating}
              className="px-3.5 py-2 text-sm font-medium disabled:opacity-50 transition-colors hover:bg-black/[0.04]"
              style={{
                ...F.body,
                background: COLORS.subtle,
                color: COLORS.text,
                borderRadius: RADIUS.pill,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              {generating ? "Generating…" : "Regenerate"}
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={14}
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
        </div>
      </details>
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs"
      style={{
        background: COLORS.subtle,
        borderRadius: RADIUS.pill,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <span style={{ ...F.body, color: COLORS.muted, fontSize: 11 }}>{label}</span>
      <span style={{ ...F.body, fontWeight: 560, color: COLORS.text, fontSize: 12 }}>{value}</span>
    </span>
  );
}
