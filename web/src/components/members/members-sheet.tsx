"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { MembersPanel } from "./members-panel";

interface MembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  isPublic: boolean;
  onTogglePublic?: (isPublic: boolean) => void;
}

export function MembersSheet({
  open,
  onOpenChange,
  agentId,
  isPublic,
  onTogglePublic,
}: MembersSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetTitle className="sr-only">Members</SheetTitle>
        <SheetDescription className="sr-only">
          Manage agent members and access
        </SheetDescription>
        {open && (
          <MembersPanel
            agentId={agentId}
            isPublic={isPublic}
            onTogglePublic={onTogglePublic}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
