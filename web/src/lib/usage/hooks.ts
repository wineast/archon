import useSWR from "swr";
import type { UsageRecordRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function buildUrl(agentId: string, path: string, params?: Record<string, string | undefined>) {
  const url = new URL(`/api/agents/${agentId}/usage/${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

interface UsageSummaryData {
  total: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    recordCount: number;
  };
  byModel: Array<{
    modelId: string;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    recordCount: number;
  }>;
  bySource: Array<{
    source: string;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    recordCount: number;
  }>;
}

export function useUsageSummary(agentId: string, from?: string, to?: string) {
  return useSWR<UsageSummaryData>(
    buildUrl(agentId, "summary", { from, to }),
    fetcher
  );
}

interface DailyUsageRow {
  date: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recordCount: number;
}

export function useUsageDaily(agentId: string, from?: string, to?: string) {
  return useSWR<DailyUsageRow[]>(
    buildUrl(agentId, "daily", { from, to }),
    fetcher
  );
}

interface UsageRecordsData {
  records: UsageRecordRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function useUsageRecords(
  agentId: string,
  page: number,
  pageSize: number,
  filters?: { from?: string; to?: string; source?: string }
) {
  return useSWR<UsageRecordsData>(
    buildUrl(agentId, "records", {
      page: String(page),
      pageSize: String(pageSize),
      from: filters?.from,
      to: filters?.to,
      source: filters?.source,
    }),
    fetcher
  );
}

interface StorageData {
  totalSize: number;
  fileCount: number;
}

export function useUsageStorage(agentId: string) {
  return useSWR<StorageData>(
    buildUrl(agentId, "storage"),
    fetcher
  );
}
