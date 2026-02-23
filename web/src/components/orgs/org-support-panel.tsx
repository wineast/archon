"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { OrgSlotAgentSelect } from "@/components/slots/org-slot-agent-select";
import { SLOT_DEFS } from "@/lib/slots/constants";

export function OrgSupportPanel({ orgId }: { orgId: string }) {
  const def = SLOT_DEFS.support;

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <div>
          <h3 className="text-sm font-medium">{def.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Support Agent
          </label>
          <OrgSlotAgentSelect orgId={orgId} slotKey="support" className="w-full" />
        </div>
      </div>
    </ScrollArea>
  );
}
