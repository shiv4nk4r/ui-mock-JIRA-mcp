import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export interface FeatureFlags {
  buildPr: boolean;
}

export interface ProviderConfig {
  provider: "claude-code";
  providerLabel: string;
  baseUrl: string;
  defaultModel: string;
  models: ModelOption[];
  features: FeatureFlags;
}

const MODELS: ModelOption[] = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",  description: "Fastest (local)" },
  { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6", description: "Balanced (local)" },
  { id: "claude-opus-4-7",           label: "Claude Opus 4.7",   description: "Most capable (local)" },
];

function isClaudeCodeAvailable(): boolean {
  try {
    execSync("which claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function GET() {
  const available = isClaudeCodeAvailable();

  const config: ProviderConfig = {
    provider: "claude-code",
    providerLabel: available ? "Claude Code (Local)" : "Claude Code (not found)",
    baseUrl: "local",
    defaultModel: "claude-haiku-4-5-20251001",
    models: MODELS,
    features: {
      buildPr: process.env.ENABLE_BUILD_PR === "true",
    },
  };

  return NextResponse.json(config);
}
