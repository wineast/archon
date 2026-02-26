"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import useSWR from "swr";
import type { AgentRow } from "@/db/schema";
import { Spinner } from "@/components/ui/spinner";
import { EvalBatchReport } from "@/components/eval/eval-batch-report";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function EvalBatchReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string; agentSlug: string; batchId: string }>;
}) {
  const { orgSlug, agentSlug, batchId } = use(params);

  const { data: agent, isLoading } = useSWR<AgentRow>(
    `/api/agents/by-slug?org=${orgSlug}&agent=${agentSlug}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!agent || !agent.id) {
    notFound();
  }

  return (
    <EvalBatchReport agent={agent} batchId={batchId} orgSlug={orgSlug} />
  );
}
