"use client";

import { LoginHeader } from "@/components/login/LoginHeader";
import { HubProvider } from "@/components/login/HubContext";
import { ProductOverview } from "@/components/login/ProductOverview";
import { PublicEngagementHub } from "@/components/login/PublicEngagementHub";
import { COLORS } from "@lib/design/tokens";

export default function LoginPage() {
  return (
    <HubProvider>
      <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg }}>
        <LoginHeader />
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 sm:py-14 space-y-14 sm:space-y-16">
          <ProductOverview />
          <PublicEngagementHub />
        </main>
      </div>
    </HubProvider>
  );
}
