"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { BuildsTable, type BuildListItem } from "@/components/builds/BuildsTable";

export default function BuildsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [builds, setBuilds] = useState<BuildListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasRunning = builds.some((b) => b.status === "running");

  async function load() {
    try {
      const res = await fetch("/api/builds");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load builds");
      setBuilds(data.builds ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load builds");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (user.role !== "internal") {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [hasRunning]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div className="space-y-1">
          <h1 style={{ ...F.body, fontSize: 28, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
            Builds
          </h1>
          <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
            Background Claude Code jobs — status, PRs, and full agent logs
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="px-3 py-1.5 text-sm font-semibold self-start"
          style={{
            ...F.body,
            background: COLORS.surface,
            color: COLORS.text,
            borderRadius: RADIUS.pill,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <p style={{ ...F.body, fontSize: 13, color: "#FF3B30" }}>{error}</p>
      )}

      {loading && builds.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="signal-bars"><span /><span /><span /><span /><span /></div>
        </div>
      ) : (
        <BuildsTable builds={builds} />
      )}

      <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
        Start builds from an approved review. Open a row to stream agent logs.{" "}
        <Link href="/reviews" style={{ color: COLORS.accent, fontWeight: 600 }}>
          Go to Reviews →
        </Link>
      </p>
    </div>
  );
}
