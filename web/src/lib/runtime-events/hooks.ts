"use client";

import useSWRInfinite from "swr/infinite";
import type { RuntimeEventType, RuntimeEventSeverity, RuntimeEventRow } from "@/db/schema";

interface RuntimeEventPage {
  items: RuntimeEventRow[];
  nextCursor?: string;
}

interface UseRuntimeEventsParams {
  agentId?: string;
  eventType?: RuntimeEventType | null;
  severity?: RuntimeEventSeverity | null;
  from?: string | null;
  to?: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useRuntimeEvents({
  agentId,
  eventType,
  severity,
  from,
  to,
}: UseRuntimeEventsParams) {
  const { data, error, isLoading, isValidating, size, setSize } =
    useSWRInfinite<RuntimeEventPage>(
      (pageIndex, previousPageData) => {
        if (!agentId) return null;
        if (pageIndex > 0 && !previousPageData?.nextCursor) return null;

        const params = new URLSearchParams();
        if (eventType) params.set("eventType", eventType);
        if (severity) params.set("severity", severity);
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (pageIndex > 0 && previousPageData?.nextCursor) {
          params.set("cursor", previousPageData.nextCursor);
        }

        const qs = params.toString();
        return `/api/agents/${agentId}/runtime-events${qs ? `?${qs}` : ""}`;
      },
      fetcher,
      { revalidateFirstPage: false }
    );

  const items = data ? data.flatMap((page) => page.items) : [];
  const hasMore = data ? !!data[data.length - 1]?.nextCursor : false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  return {
    items,
    isLoading,
    isLoadingMore: !!isLoadingMore,
    isValidating,
    hasMore,
    loadMore: () => setSize(size + 1),
    error,
  };
}
