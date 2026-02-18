"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { ModelConfigPanel } from "./model-config-panel";

export function ModelConfigSheet({
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
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Model Configs</SheetTitle>
        <SheetDescription className="sr-only">
          Manage your model configuration presets
        </SheetDescription>
        {open && <ModelConfigPanel agentId={agentId} />}
      </SheetContent>
    </Sheet>
  );
}
