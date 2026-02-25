"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import useSWR from "swr";
import type { AgentRow } from "@/db/schema";
import { Spinner } from "@/components/ui/spinner";
import { EvalRunReport } from "@/components/eval/eval-run-report";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function EvalReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string; agentSlug: string; runId: string }>;
}) {
  const { orgSlug, agentSlug, runId } = use(params);

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

  return <EvalRunReport agent={agent} runId={runId} orgSlug={orgSlug} />;
}
