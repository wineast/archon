"use client";

import { useCallback, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentSlots, updateAgentSlot, deleteAgentSlot } from "@/lib/slots/hooks";
import { useAgents } from "@/lib/agents/hooks";
import type { AgentSlotKey } from "@/db/schema";
import { cn } from "@/lib/utils";

interface SlotAgentSelectProps {
  agentId: string;
  orgId: string;
  slotKey: AgentSlotKey;
  className?: string;
  onChanged?: (targetAgentId: string | null) => void;
}

const NONE_VALUE = "__none__";

export function SlotAgentSelect({ agentId, orgId, slotKey, className, onChanged }: SlotAgentSelectProps) {
  const { slots, mutate } = useAgentSlots(agentId);
  const { agents } = useAgents(orgId);
  const [busy, setBusy] = useState(false);

  const currentSlot = slots.find((s) => s.slotKey === slotKey);
  const currentAgentId = currentSlot?.agentId ?? null;

  const handleChange = useCallback(
    async (value: string) => {
      setBusy(true);
      if (value === NONE_VALUE) {
        await deleteAgentSlot(agentId, slotKey, mutate);
        onChanged?.(null);
      } else {
        await updateAgentSlot(agentId, slotKey, value, mutate);
        onChanged?.(value);
      }
      setBusy(false);
    },
    [agentId, slotKey, mutate, onChanged]
  );

  return (
    <Select
      value={currentAgentId ?? NONE_VALUE}
      onValueChange={handleChange}
      disabled={busy}
    >
      <SelectTrigger className={cn("h-7 text-xs", className)} data-testid="select-judge-agent">
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
