"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { FunctionsPanel } from "./functions-panel";

export function FunctionsSheet({
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
        <SheetTitle className="sr-only">Functions</SheetTitle>
        <SheetDescription className="sr-only">
          Manage reusable server-side functions
        </SheetDescription>
        {open && <FunctionsPanel agentId={agentId} />}
      </SheetContent>
    </Sheet>
  );
}
