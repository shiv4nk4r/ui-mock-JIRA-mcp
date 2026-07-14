"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** History is now part of the Gemini-style home shell. */
export default function HistoryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="signal-bars"><span /><span /><span /><span /><span /></div>
    </div>
  );
}
