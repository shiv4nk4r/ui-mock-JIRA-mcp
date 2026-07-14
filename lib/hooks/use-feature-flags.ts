"use client";

import { useEffect, useState } from "react";

export interface FeatureFlags {
  buildPr: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  buildPr: false, // all features off until explicitly opted in
};

let cachedFlags: FeatureFlags | null = null;

/**
 * Returns feature flags fetched from /api/config.
 * All flags default to false — opt-in only via env vars.
 * Result is cached in module scope so only one fetch happens per page load.
 */
export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(cachedFlags ?? DEFAULT_FLAGS);

  useEffect(() => {
    if (cachedFlags) {
      setFlags(cachedFlags);
      return;
    }
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: { features?: Partial<FeatureFlags> }) => {
        const resolved: FeatureFlags = {
          ...DEFAULT_FLAGS,
          ...(cfg.features ?? {}),
        };
        cachedFlags = resolved;
        setFlags(resolved);
      })
      .catch(() => {
        /* network failure — keep all flags false */
      });
  }, []);

  return flags;
}
