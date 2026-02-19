"use client";

import useSWRInfinite from "swr/infinite";
import type { AuditLogAction, AuditLogResourceType } from "@/db/schema";

export interface AuditLogItem {
  id: string;
  agentId: string;
  userId: string | null;
  action: AuditLogAction;
  resourceType: AuditLogResourceType;
  resourceId: string;
  resourceKey: string | null;
  resourceName: string | null;
  createdAt: string;
  userNickname: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
}

interface AuditLogPage {
  items: AuditLogItem[];
  nextCursor?: string;
}

interface UseAuditLogsParams {
  agentId?: string;
  resourceType?: AuditLogResourceType | null;
  userId?: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAuditLogs({ agentId, resourceType, userId }: UseAuditLogsParams) {
  const { data, error, isLoading, isValidating, size, setSize } =
    useSWRInfinite<AuditLogPage>(
      (pageIndex, previousPageData) => {
        if (!agentId) return null;
        if (pageIndex > 0 && !previousPageData?.nextCursor) return null;

        const params = new URLSearchParams();
        if (resourceType) params.set("resourceType", resourceType);
        if (userId) params.set("userId", userId);
        if (pageIndex > 0 && previousPageData?.nextCursor) {
          params.set("cursor", previousPageData.nextCursor);
        }

        const qs = params.toString();
        return `/api/agents/${agentId}/audit-logs${qs ? `?${qs}` : ""}`;
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
