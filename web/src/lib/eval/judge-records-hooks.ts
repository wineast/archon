"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface JudgeRecordGroup {
  agentId: string;
  agentName: string;
  agentSlug: string;
  runs: Array<{
    id: string;
    agentId: string | null;
    chatModel: string;
    totalCases: number;
    passedAssertions: number;
    averageScore: number | null;
    createdAt: string;
  }>;
}

export function useJudgeRecords(judgeAgentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<JudgeRecordGroup[]>(
    judgeAgentId ? `/api/judge-records?judgeAgentId=${judgeAgentId}` : null,
    fetcher
  );

  return {
    groups: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
