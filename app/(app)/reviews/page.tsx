"use client";

import { useAuth } from "@lib/auth/auth-context";
import { InternalReviewsPage } from "@/components/reviews/InternalReviewsPage";
import { PmReviewsPage } from "@/components/reviews/PmReviewsPage";

export default function ReviewsPage() {
  const { user } = useAuth();
  if (user?.role === "internal") return <InternalReviewsPage />;
  return <PmReviewsPage />;
}
