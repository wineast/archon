"use client";

import { use, Suspense } from "react";
import { notFound } from "next/navigation";
import useSWR from "swr";
import { Spinner } from "@/components/ui/spinner";
import { ChatPageContent } from "@/components/chat-page-content";
import { useTranslations } from "next-intl";
import type { AgentRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function PreviewChatContent({ agent, orgSlug }: { agent: AgentRow; orgSlug: string }) {
  const t = useTranslations("chat");

  return (
    <ChatPageContent
      agent={agent}
      orgSlug={orgSlug}
      transportBodyExtras={{ draft: true, source: "preview" }}
      sessionSource="preview"
      banner={
        <div className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-4 py-1">
          <span className="text-xs text-muted-foreground">
            {t("draftPreview")}
          </span>
        </div>
      }
      requiredRole="editor"
    />
  );
}

export default function AgentPreviewPage({
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
      <PreviewChatContent agent={agent} orgSlug={orgSlug} />
    </Suspense>
  );
}
