"use client";

import { useEffect, useState } from "react";
import { F } from "@lib/design/tokens";

const STATUS_WORDS = [
  "Thinking",
  "Spelunking",
  "Solving",
  "Roaming",
  "Vibing",
  "Pondering",
  "Noodling",
  "Unpacking",
] as const;

const ROTATE_MS = 1800;

/**
 * Claude-style status while the agent works — cycling verbs with a soft shimmer.
 * When done, renders nothing so only the assistant message remains.
 */
export function ThinkingBlock({
  done,
}: {
  log?: string[];
  done: boolean;
  elapsed?: number;
  showMcp?: boolean;
}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => {
      setWordIndex((i) => (i + 1) % STATUS_WORDS.length);
      setFadeKey((k) => k + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [done]);

  if (done) return null;

  const label = STATUS_WORDS[wordIndex];

  return (
    <div className="flex items-center py-0.5 mb-0.5" aria-live="polite" aria-label={label}>
      <span
        key={fadeKey}
        className="thinking-status"
        style={{
          ...F.body,
          fontSize: 14,
          fontWeight: 520,
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
