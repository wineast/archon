"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function buildUrl(orgId: string, path: string, params?: Record<string, string | undefined>) {
  const url = new URL(`/api/orgs/${orgId}/usage/${path}`, window.location.origin);
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

export function useOrgUsageSummary(orgId?: string, from?: string, to?: string) {
  return useSWR<UsageSummaryData>(
    orgId ? buildUrl(orgId, "summary", { from, to }) : null,
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

export function useOrgUsageDaily(orgId?: string, from?: string, to?: string) {
  return useSWR<DailyUsageRow[]>(
    orgId ? buildUrl(orgId, "daily", { from, to }) : null,
    fetcher
  );
}

interface ByAgentUsageRow {
  agentId: string;
  agentName: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recordCount: number;
}

export function useOrgUsageByAgent(orgId?: string, from?: string, to?: string) {
  return useSWR<ByAgentUsageRow[]>(
    orgId ? buildUrl(orgId, "by-agent", { from, to }) : null,
    fetcher
  );
}
