"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import { fetchReviewsForNav } from "@lib/utils/review-notifications";
import { useTicketHistory } from "@lib/hooks/use-ticket-history";
import type { TicketHistoryGroup } from "@lib/utils/session-history";
import { F, COLORS } from "@lib/design/tokens";
import { TicketHistorySidebar } from "@/components/shell/TicketHistorySidebar";

export type HomeChromeData = {
  groups: TicketHistoryGroup[];
  loading: boolean;
  refresh: () => void;
  /** Bumps when "New mock" is pressed while already on /dashboard. */
  newMockNonce: number;
};

const HomeChromeContext = createContext<HomeChromeData | null>(null);

export function useHomeChrome(): HomeChromeData {
  const ctx = useContext(HomeChromeContext);
  if (!ctx) {
    throw new Error("useHomeChrome must be used within HomeChromeFrame");
  }
  return ctx;
}

function ticketIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/workspace\/([^/]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Shared Gemini-style left chrome for every authenticated app route. */
export function HomeChromeFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [newMockNonce, setNewMockNonce] = useState(0);
  const { groups, loading, refresh } = useTicketHistory();
  const activeTicketId = ticketIdFromPath(pathname);

  useEffect(() => {
    if (!user) return;
    fetchReviewsForNav(user.id, user.role, (filter) => repository.getReviews(filter)).then(setReviewCount);
  }, [user, pathname]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const handleNewMock = useCallback(() => {
    setMobileSidebarOpen(false);
    if (pathname === "/dashboard") {
      setNewMockNonce((n) => n + 1);
      return;
    }
    router.push("/dashboard");
  }, [pathname, router]);

  const data = useMemo<HomeChromeData>(
    () => ({ groups, loading, refresh, newMockNonce }),
    [groups, loading, refresh, newMockNonce],
  );

  const sidebar = (
    <TicketHistorySidebar
      groups={groups}
      loading={loading}
      activeTicketId={activeTicketId}
      onNewMock={handleNewMock}
      onDeleted={refresh}
      homeChrome
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
      reviewCount={reviewCount}
    />
  );

  return (
    <HomeChromeContext.Provider value={data}>
      <div className="flex h-full min-h-0 w-full overflow-hidden" style={{ background: COLORS.subtle }}>
        <div className="hidden md:flex h-full shrink-0">{sidebar}</div>

        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-[90] flex">
            <div className="absolute inset-0 bg-black/25" onClick={() => setMobileSidebarOpen(false)} aria-hidden />
            <div className="relative z-10 h-full shadow-xl">
              <TicketHistorySidebar
                groups={groups}
                loading={loading}
                activeTicketId={activeTicketId}
                onNewMock={handleNewMock}
                onDeleted={() => {
                  refresh();
                  setMobileSidebarOpen(false);
                }}
                homeChrome
                reviewCount={reviewCount}
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
          <div className="md:hidden relative z-10 flex-none flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 -ml-1 rounded-full hover:bg-black/5"
              aria-label="Open menu"
              style={{ ...F.body, fontSize: 18, color: COLORS.text }}
            >
              ☰
            </button>
          </div>
          {children}
        </div>
      </div>
    </HomeChromeContext.Provider>
  );
}
