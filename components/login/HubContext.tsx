"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { repository } from "@lib/storage";

export type HubTab = "features" | "testimonials" | "feedback";

interface HubContextValue {
  tab: HubTab;
  setTab: (tab: HubTab) => void;
  counts: Record<HubTab, number>;
  refreshCounts: () => void;
}

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<HubTab>("features");
  const [counts, setCounts] = useState<Record<HubTab, number>>({
    features: 0,
    testimonials: 0,
    feedback: 0,
  });

  async function refreshCounts() {
    const [f, t, b] = await Promise.all([
      repository.getEngagement({ type: "feature_request" }),
      repository.getEngagement({ type: "testimonial" }),
      repository.getEngagement({ type: "feedback" }),
    ]);
    setCounts({ features: f.length, testimonials: t.length, feedback: b.length });
  }

  useEffect(() => {
    refreshCounts();
  }, []);

  return (
    <HubContext.Provider value={{ tab, setTab, counts, refreshCounts }}>
      {children}
    </HubContext.Provider>
  );
}

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used within HubProvider");
  return ctx;
}

export const HUB_TABS: { id: HubTab; label: string }[] = [
  { id: "features", label: "Feature requests" },
  { id: "testimonials", label: "Testimonials" },
  { id: "feedback", label: "Recent feedback" },
];
