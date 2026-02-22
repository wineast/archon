"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface ResolvedEvaluator {
  judgeAgentId: string | null;
  judgeAgentName: string | null;
  judgeAgentSlug: string | null;
}

export function useResolvedEvaluator(agentId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ResolvedEvaluator>(
    agentId ? `/api/eval/resolve-judge?agentId=${agentId}` : null,
    fetcher
  );

  return {
    evaluator: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
