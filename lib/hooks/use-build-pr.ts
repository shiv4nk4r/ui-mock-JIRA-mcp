"use client";

import { useCallback, useRef, useState } from "react";
import type { MockupSession, ReviewBuildState, ReviewItem } from "@lib/types";
import { repository } from "@lib/storage";
import { buildAgentPrompt, buildExecutionDetails } from "@lib/utils/execution-details";

export interface BuildProgress {
  phase?: string;
  message?: string;
  branchName?: string;
}

interface StartBuildArgs {
  review: ReviewItem;
  session: MockupSession | null;
  reviewUrl?: string;
}

export function useBuildPr() {
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startBuild = useCallback(async ({ review, session, reviewUrl }: StartBuildArgs) => {
    if (review.status !== "approved") {
      throw new Error("Review must be approved before building");
    }
    const details = buildExecutionDetails(review, session);
    const agentPrompt = buildAgentPrompt(details, review, session);
    if (!agentPrompt.trim()) {
      throw new Error("No implementation prompt available — open the plan and ensure handoff was generated");
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setProgress({ phase: "git", message: "Starting build…" });

    const runningPatch: ReviewBuildState = {
      status: "running",
      branchName: `${review.ticketId}-gcc-studio`,
      startedAt: Date.now(),
      error: undefined,
      prUrl: review.build?.prUrl,
      prNumber: review.build?.prNumber,
    };
    await repository.updateReview(review.id, { build: runningPatch });

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          reviewId: review.id,
          ticketId: review.ticketId,
          ticketSummary: review.ticketSummary,
          reviewStatus: review.status,
          agentPrompt,
          changeLog: details.changeLogMarkdown ?? review.handoff?.changeLog,
          mockHtml: session?.activeHtml || review.activeHtml,
          reviewUrl,
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Build request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finalBuild: ReviewBuildState = { ...runningPatch };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (typeof data.message === "string") {
            setProgress({
              phase: typeof data.phase === "string" ? data.phase : undefined,
              message: data.message,
              branchName: typeof data.branchName === "string" ? data.branchName : undefined,
            });
          }

          if (data.done) {
            if (data.status === "succeeded" && typeof data.prUrl === "string") {
              finalBuild = {
                status: "succeeded",
                branchName: typeof data.branchName === "string" ? data.branchName : runningPatch.branchName,
                prUrl: data.prUrl,
                prNumber: typeof data.prNumber === "number" ? data.prNumber : undefined,
                startedAt: runningPatch.startedAt,
                finishedAt: Date.now(),
              };
            } else {
              finalBuild = {
                status: "failed",
                branchName: typeof data.branchName === "string" ? data.branchName : runningPatch.branchName,
                error: typeof data.error === "string" ? data.error : "Build failed",
                startedAt: runningPatch.startedAt,
                finishedAt: Date.now(),
                prUrl: runningPatch.prUrl,
                prNumber: runningPatch.prNumber,
              };
            }
          }
        }
      }

      await repository.updateReview(review.id, { build: finalBuild });
      setProgress(
        finalBuild.status === "succeeded"
          ? { phase: "done", message: "PR ready", branchName: finalBuild.branchName }
          : { phase: "done", message: finalBuild.error || "Build failed", branchName: finalBuild.branchName },
      );
      return finalBuild;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        const aborted: ReviewBuildState = {
          status: "failed",
          branchName: runningPatch.branchName,
          error: "Build cancelled",
          startedAt: runningPatch.startedAt,
          finishedAt: Date.now(),
        };
        await repository.updateReview(review.id, { build: aborted });
        return aborted;
      }
      const message = err instanceof Error ? err.message : String(err);
      const failed: ReviewBuildState = {
        status: "failed",
        branchName: runningPatch.branchName,
        error: message,
        startedAt: runningPatch.startedAt,
        finishedAt: Date.now(),
      };
      await repository.updateReview(review.id, { build: failed });
      setProgress({ phase: "done", message });
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  return { startBuild, busy, progress, setProgress };
}
