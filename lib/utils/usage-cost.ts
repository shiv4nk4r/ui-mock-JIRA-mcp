import type { UsageRecord } from "@lib/types";

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function sumUsageRecords(records: UsageRecord[]): UsageTotals {
  return records.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + r.inputTokens,
      outputTokens: acc.outputTokens + r.outputTokens,
      costUsd: acc.costUsd + r.costUsd,
    }),
    { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  );
}

export function formatCostUsd(cost: number): string {
  if (!cost || cost <= 0) return "$0.00";
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(6)}`;
}

export function shortModelName(model: string): string {
  return model.replace(/^claude-/, "").replace(/-20251001$/, "").replace(/-20250514$/, "");
}
