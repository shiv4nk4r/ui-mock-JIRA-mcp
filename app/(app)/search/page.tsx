"use client";

import { useHomeChrome } from "@/components/shell/HomeChromeFrame";
import { SearchMocksView } from "@/components/shell/SearchMocksView";

export default function SearchMocksPage() {
  const { groups, loading } = useHomeChrome();
  return <SearchMocksView groups={groups} loading={loading} />;
}
