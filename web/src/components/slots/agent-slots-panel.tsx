"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcwIcon } from "lucide-react";
import {
  useAgentSlots,
  updateAgentSlotOverride,
  deleteAgentSlotOverride,
} from "@/lib/slots/hooks";
import { useAgents } from "@/lib/agents/hooks";
import { SLOT_DEFS } from "@/lib/slots/constants";
import { SLOT_KEYS } from "@/db/schema";
import type { SlotKey } from "@/db/schema";

export function AgentSlotsPanel({
  agentId,
  orgId,
}: {
  agentId: string;
  orgId: string;
}) {
  const t = useTranslations("build");
  const { slots, isLoading, mutate } = useAgentSlots(agentId);
  const { agents } = useAgents(orgId);
  const [busy, setBusy] = useState<SlotKey | null>(null);

  const slotMap = new Map(slots.map((s) => [s.slotKey, s]));

  const handleOverride = useCallback(
    async (slotKey: SlotKey, targetAgentId: string) => {
      setBusy(slotKey);
      await updateAgentSlotOverride(agentId, slotKey, targetAgentId, mutate);
      setBusy(null);
    },
    [agentId, mutate]
  );

  const handleResetToOrg = useCallback(
    async (slotKey: SlotKey) => {
      setBusy(slotKey);
      await deleteAgentSlotOverride(agentId, slotKey, mutate);
      setBusy(null);
    },
    [agentId, mutate]
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
          const isOverride = slot?.source === "override";

          return (
            <div key={slotKey} className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {def.label}
                </label>
                {isOverride && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {t("slotOverride")}
                  </span>
                )}
                {slot?.source === "org" && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {t("slotInherited")}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground/70">
                {def.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Select
                  value={slot?.agentId ?? ""}
                  onValueChange={(v) => handleOverride(slotKey, v)}
                  disabled={busy !== null}
                >
                  <SelectTrigger className="flex-1">
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
                {isOverride && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={busy !== null}
                    onClick={() => handleResetToOrg(slotKey)}
                    title={t("slotResetToOrg")}
                  >
                    <RotateCcwIcon className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
