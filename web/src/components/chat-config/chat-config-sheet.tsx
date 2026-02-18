"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { chatConfigApiKey, updateChatConfig } from "@/lib/chat-config/hooks";
import type { ChatConfigRow } from "@/db/schema";
import { ChatConfigDetail } from "./chat-config-detail";
import useSWR from "swr";
import { useCallback } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ChatConfigSheet({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
  const { data: config, mutate } = useSWR<ChatConfigRow>(
    open ? chatConfigApiKey(agentId) : null,
    fetcher
  );

  const handleSave = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      await updateChatConfig(id, data, mutate);
    },
    [mutate]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetTitle className="sr-only">Chat Config</SheetTitle>
        <SheetDescription className="sr-only">
          Edit your chat configuration
        </SheetDescription>

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
      </SheetContent>
    </Sheet>
  );
}
