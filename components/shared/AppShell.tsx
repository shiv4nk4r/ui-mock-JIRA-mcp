"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { COLORS } from "@lib/design/tokens";
import { HomeChromeFrame } from "@/components/shell/HomeChromeFrame";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center" style={{ height: "100dvh", background: COLORS.bg }}>
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div
      className="w-full flex flex-col overflow-hidden"
      style={{ height: "100dvh", maxHeight: "100dvh", background: COLORS.subtle }}
    >
      <HomeChromeFrame>
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
          {children}
        </div>
      </HomeChromeFrame>
    </div>
  );
}
