"use client";

import { LoginHeader } from "@/components/login/LoginHeader";
import { HubProvider } from "@/components/login/HubContext";
import { ProductOverview } from "@/components/login/ProductOverview";
import { PublicEngagementHub } from "@/components/login/PublicEngagementHub";
import { COLORS } from "@lib/design/tokens";

export default function LoginPage() {
  return (
    <HubProvider>
      <div
        className="min-h-screen flex flex-col relative overflow-x-hidden"
        style={{ background: COLORS.subtle }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(217,119,6,0.12) 0%, transparent 70%)",
          }}
        />
        <LoginHeader />
        <main className="relative z-10 flex-1 w-full mx-auto px-5 sm:px-8 pb-20 sm:pb-28">
          <ProductOverview />
          <PublicEngagementHub />
        </main>
      </div>
    </HubProvider>
  );
}
