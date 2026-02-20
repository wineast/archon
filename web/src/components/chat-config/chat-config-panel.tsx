"use client";

import { chatConfigApiKey, updateChatConfig } from "@/lib/chat-config/hooks";
import type { ChatConfigRow } from "@/db/schema";
import { ChatConfigDetail } from "./chat-config-detail";
import { GuideDialog } from "@/components/ui/guide-dialog";
import chatConfigGuide from "../../../guide/chat-config.md";
import useSWR from "swr";
import { useCallback } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ChatConfigPanel({ agentId }: { agentId: string }) {
  const { data: config, mutate } = useSWR<ChatConfigRow>(
    chatConfigApiKey(agentId),
    fetcher
  );

  const handleSave = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await updateChatConfig(id, data, mutate);
    },
    [mutate]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-sm font-semibold">Config</span>
        <GuideDialog title="对话配置" content={chatConfigGuide} />
        <div className="flex-1" />
      </div>
      {config ? (
        <ChatConfigDetail
          key={config.id}
          config={config}
          onSave={handleSave}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No config found
        </div>
      )}
    </div>
  );
}
