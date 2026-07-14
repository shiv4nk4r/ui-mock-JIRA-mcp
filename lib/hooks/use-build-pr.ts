"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type BuildServerPayload = ReviewBuildState & {
  active?: boolean;
  files?: string[];
  model?: string;
};

const POLL_MS = 2000;

function toBuildState(payload: BuildServerPayload): ReviewBuildState {
  return {
    status: payload.status,
    jobId: payload.jobId,
    branchName: payload.branchName,
    prUrl: payload.prUrl,
    prNumber: payload.prNumber,
    phase: payload.phase,
    message: payload.message,
    error: payload.error,
    startedAt: payload.startedAt,
    finishedAt: payload.finishedAt,
    updatedAt: payload.updatedAt,
  };
}

async function fetchBuildStatus(reviewId: string): Promise<BuildServerPayload | null> {
  const res = await fetch(`/api/build?reviewId=${encodeURIComponent(reviewId)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { build: BuildServerPayload | null };
  return data.build ?? null;
}

export function useBuildPr(reviewId?: string) {
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onUpdateRef = useRef<((build: ReviewBuildState) => void) | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyServerBuild = useCallback(
    async (reviewIdToUpdate: string, payload: BuildServerPayload) => {
      const build = toBuildState(payload);
      await repository.updateReview(reviewIdToUpdate, { build });
      setProgress({
        phase: build.phase,
        message: build.message || build.error,
        branchName: build.branchName,
      });
      onUpdateRef.current?.(build);
      setBusy(build.status === "running");
      if (build.status !== "running") {
        stopPolling();
      }
      return build;
    },
    [stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setBusy(true);
      pollRef.current = setInterval(async () => {
        try {
          const payload = await fetchBuildStatus(id);
          if (!payload) return;
          await applyServerBuild(id, payload);
        } catch {
          /* keep polling */
        }
      }, POLL_MS);
    },
    [applyServerBuild, stopPolling],
  );

  /** Resume watching a server job (e.g. after reopening the review page). */
  const watchBuild = useCallback(
    async (id: string, onUpdate?: (build: ReviewBuildState) => void) => {
      onUpdateRef.current = onUpdate ?? null;
      const payload = await fetchBuildStatus(id);
      if (!payload) return null;
      const build = await applyServerBuild(id, payload);
      if (build.status === "running") {
        startPolling(id);
      }
      return build;
    },
    [applyServerBuild, startPolling],
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // If the review was left mid-build, resume polling when the hook mounts with an id.
  useEffect(() => {
    if (!reviewId) return;
    let cancelled = false;
    (async () => {
      const local = await repository.getReview(reviewId);
      const server = await fetchBuildStatus(reviewId);
      if (cancelled) return;
      if (server) {
        await applyServerBuild(reviewId, server);
        if (server.status === "running") startPolling(reviewId);
        return;
      }
      if (local?.build?.status === "running") {
        // Client thinks it's running but server has nothing — clear stale state
        const failed: ReviewBuildState = {
          ...local.build,
          status: "failed",
          error: "Build status lost. Retry Build.",
          message: "Build status lost. Retry Build.",
          finishedAt: Date.now(),
          phase: "done",
        };
        await repository.updateReview(reviewId, { build: failed });
        setBusy(false);
        onUpdateRef.current?.(failed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewId, applyServerBuild, startPolling]);

  const startBuild = useCallback(
    async ({ review, session, reviewUrl }: StartBuildArgs) => {
      if (review.status !== "approved") {
        throw new Error("Review must be approved before building");
      }
      const details = buildExecutionDetails(review, session);
      const agentPrompt = buildAgentPrompt(details, review, session);
      if (!agentPrompt.trim()) {
        throw new Error(
          "No implementation prompt available — open the plan and ensure handoff was generated",
        );
      }

      setBusy(true);
      setProgress({ phase: "queued", message: "Starting background build…" });

      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        build?: BuildServerPayload;
        message?: string;
      } | null;

      if (!res.ok) {
        setBusy(false);
        throw new Error(data?.error || `Build request failed (${res.status})`);
      }

      if (data?.build) {
        await applyServerBuild(review.id, data.build);
      } else {
        const running: ReviewBuildState = {
          status: "running",
          branchName: `${review.ticketId}-gcc-studio`,
          startedAt: Date.now(),
          phase: "queued",
          message: data?.message || "Build queued…",
        };
        await repository.updateReview(review.id, { build: running });
        setProgress({ phase: "queued", message: running.message });
      }

      startPolling(review.id);
      // Kick an immediate poll so UI updates without waiting 2s
      const immediate = await fetchBuildStatus(review.id);
      if (immediate) {
        return applyServerBuild(review.id, immediate);
      }
      return (
        data?.build ? toBuildState(data.build) : ({ status: "running" } as ReviewBuildState)
      );
    },
    [applyServerBuild, startPolling],
  );

  return { startBuild, watchBuild, busy, progress, setProgress, stopPolling };
}
