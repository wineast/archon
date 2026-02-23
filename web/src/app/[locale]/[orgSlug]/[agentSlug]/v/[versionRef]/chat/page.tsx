"use client";

import { use, Suspense } from "react";
import { notFound } from "next/navigation";
import useSWR from "swr";
import { Spinner } from "@/components/ui/spinner";
import { ChatPageContent } from "@/components/chat-page-content";
import { useTranslations } from "next-intl";
import type { AgentRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function VersionBanner({ version }: { version: string }) {
  const t = useTranslations("chat");
  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-4 py-1">
      <span className="text-xs text-muted-foreground">
        {t("versionChat", { version })}
      </span>
    </div>
  );
}

function VersionChatContent({
  agent,
  orgSlug,
  versionRef,
}: {
  agent: AgentRow;
  orgSlug: string;
  versionRef: string;
}) {
  const { data: versionInfo, isLoading: versionLoading } = useSWR<{
    id: string;
    version: string;
    changelog: string;
    createdAt: string;
  }>(
    agent?.id
      ? `/api/agents/${agent.id}/versions/by-ref?ref=${encodeURIComponent(versionRef)}`
      : null,
    fetcher
  );

  if (versionLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!versionInfo) {
    notFound();
  }

  return (
    <ChatPageContent
      agent={agent}
      orgSlug={orgSlug}
      versionMode={{ versionId: versionInfo.id }}
      transportBodyExtras={{
        versionId: versionInfo.id,
        source: `version:${versionInfo.id}`,
      }}
      sessionSource={`version:${versionInfo.id}`}
      banner={<VersionBanner version={versionInfo.version} />}
    />
  );
}

export default function VersionChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string; agentSlug: string; versionRef: string }>;
}) {
  const { orgSlug, agentSlug, versionRef } = use(params);

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
    <Suspense
      fallback={
        <div className="flex h-svh items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <VersionChatContent
        agent={agent}
        orgSlug={orgSlug}
        versionRef={versionRef}
      />
    </Suspense>
  );
}
