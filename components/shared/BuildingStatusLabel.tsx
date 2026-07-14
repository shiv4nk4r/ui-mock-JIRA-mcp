"use client";

import { useEffect, useState } from "react";
import { F } from "@lib/design/tokens";

const BUILDING_WORDS = [
  "Building",
  "Crafting",
  "Composing",
  "Shaping",
  "Assembling",
  "Sketching",
  "Wiring",
  "Baking",
] as const;

const ROTATE_MS = 5000;

/** Subtle Claude-style cycling status for mocks currently generating. */
export function BuildingStatusLabel({ className }: { className?: string }) {
  const [wordIndex, setWordIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setWordIndex((i) => (i + 1) % BUILDING_WORDS.length);
      setFadeKey((k) => k + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      key={fadeKey}
      className={`building-status shrink-0 ${className ?? ""}`}
      style={{
        ...F.body,
        fontSize: "inherit",
        fontWeight: 520,
        letterSpacing: "0.01em",
      }}
      aria-label="Building"
    >
      {BUILDING_WORDS[wordIndex]}
    </span>
  );
}
