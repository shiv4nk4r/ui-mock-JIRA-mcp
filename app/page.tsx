"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F6F3" }}>
      <div className="signal-bars"><span /><span /><span /><span /><span /></div>
    </div>
  );
}
