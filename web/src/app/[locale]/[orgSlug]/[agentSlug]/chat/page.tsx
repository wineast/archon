"use client";

import { use, Suspense } from "react";
import { notFound } from "next/navigation";
import useSWR from "swr";
import { RocketIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ChatPageContent } from "@/components/chat-page-content";
import { useTranslations } from "next-intl";
import type { AgentRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function AgentChatContent({ agent, orgSlug }: { agent: AgentRow; orgSlug: string }) {
  const t = useTranslations("chat");

  if (!agent.publishedVersionId) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4 text-center">
        <RocketIcon className="size-12 opacity-30" />
        <p className="text-muted-foreground">{t("notPublished")}</p>
      </div>
    );
  }

  return (
    <ChatPageContent
      agent={agent}
      orgSlug={orgSlug}
      versionMode="published"
      sessionSource="chat"
      features={{ share: true, importExport: true, userSettings: true }}
    />
  );
}

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string; agentSlug: string }>;
}) {
  const { orgSlug, agentSlug } = use(params);

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
      <AgentChatContent agent={agent} orgSlug={orgSlug} />
    </Suspense>
  );
}
