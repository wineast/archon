"use client";

import { useCallback, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgSlots, updateOrgSlot, deleteOrgSlot } from "@/lib/slots/hooks";
import { useAgents } from "@/lib/agents/hooks";
import type { OrgSlotKey } from "@/db/schema";
import { cn } from "@/lib/utils";

interface OrgSlotAgentSelectProps {
  orgId: string;
  slotKey: OrgSlotKey;
  className?: string;
  onChanged?: () => void;
}

const NONE_VALUE = "__none__";

export function OrgSlotAgentSelect({ orgId, slotKey, className, onChanged }: OrgSlotAgentSelectProps) {
  const { slots, mutate } = useOrgSlots(orgId);
  const { agents } = useAgents(orgId);
  const [busy, setBusy] = useState(false);

  const currentSlot = slots.find((s) => s.slotKey === slotKey);
  const currentAgentId = currentSlot?.agentId ?? null;

  const handleChange = useCallback(
    async (value: string) => {
      setBusy(true);
      if (value === NONE_VALUE) {
        await deleteOrgSlot(orgId, slotKey, mutate);
      } else {
        await updateOrgSlot(orgId, slotKey, value, mutate);
      }
      setBusy(false);
      onChanged?.();
    },
    [orgId, slotKey, mutate, onChanged]
  );

  return (
    <Select
      value={currentAgentId ?? NONE_VALUE}
      onValueChange={handleChange}
      disabled={busy}
    >
      <SelectTrigger className={cn("h-7 text-xs", className)}>
        <SelectValue placeholder="未配置" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE} className="text-xs text-muted-foreground">
          未配置
        </SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id} className="text-xs">
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
