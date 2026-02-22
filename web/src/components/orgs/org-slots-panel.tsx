"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgSlots, updateOrgSlot } from "@/lib/slots/hooks";
import { useAgents } from "@/lib/agents/hooks";
import { SLOT_DEFS } from "@/lib/slots/constants";
import { SLOT_KEYS } from "@/db/schema";
import type { SlotKey } from "@/db/schema";

export function OrgSlotsPanel({ orgId }: { orgId: string }) {
  const t = useTranslations("org");
  const { slots, isLoading, mutate } = useOrgSlots(orgId);
  const { agents } = useAgents(orgId);
  const [busy, setBusy] = useState<SlotKey | null>(null);

  const slotMap = new Map(slots.map((s) => [s.slotKey, s]));

  const handleChange = useCallback(
    async (slotKey: SlotKey, agentId: string) => {
      setBusy(slotKey);
      await updateOrgSlot(orgId, slotKey, agentId, mutate);
      setBusy(null);
    },
    [orgId, mutate]
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <div>
          <h3 className="text-sm font-medium">{t("slots")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("slotsDescription")}
          </p>
        </div>

        {SLOT_KEYS.map((slotKey) => {
          const def = SLOT_DEFS[slotKey];
          const slot = slotMap.get(slotKey);

          return (
            <div key={slotKey} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {def.label}
              </label>
              <p className="text-xs text-muted-foreground/70">
                {def.description}
              </p>
              <Select
                value={slot?.agentId ?? ""}
                onValueChange={(v) => handleChange(slotKey, v)}
                disabled={busy !== null}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={def.defaultAgentName} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
