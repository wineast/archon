"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatConfigPanel } from "./chat-config-panel";

export function ChatConfigSheet({
  open,
  onOpenChange,
  agentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}) {
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
        {open && <ChatConfigPanel agentId={agentId} />}
      </SheetContent>
    </Sheet>
  );
}
