"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { EvalPanel } from "./eval-panel";

interface EvalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export function EvalSheet({
  open,
  onOpenChange,
  agentId,
}: EvalSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-[70vw]"
      >
        <SheetTitle className="sr-only">Evaluation</SheetTitle>
        <SheetDescription className="sr-only">
          Manage eval cases, judge configs, and run evaluations
        </SheetDescription>
        {open && <EvalPanel agentId={agentId} />}
      </SheetContent>
    </Sheet>
  );
}
