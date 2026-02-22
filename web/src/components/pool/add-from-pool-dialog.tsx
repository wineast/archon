"use client";

import { useTranslations } from "next-intl";
import { CheckIcon, PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { usePoolResources } from "@/lib/pool/hooks";
import { addAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import type { ResourceType } from "@/db/schema";
import { toast } from "sonner";
import { useState, useCallback, useMemo } from "react";

interface AddFromPoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ResourceType;
  agentId: string;
  onAdded?: () => void;
}

export function AddFromPoolDialog({
  open,
  onOpenChange,
  resourceType,
  agentId,
  onAdded,
}: AddFromPoolDialogProps) {
  const t = useTranslations("admin");
  const { data: poolResources = [], isLoading } = usePoolResources<{
    id: string;
    key: string;
    name: string;
    origin: string;
  }>(resourceType);
  const { data: refs = [], mutate: mutateRefs } = useAgentRefs(agentId);
  const [busy, setBusy] = useState<string | null>(null);

  const existingRefResourceIds = useMemo(
    () =>
      new Set(
        refs
          .filter((r) => r.resourceType === resourceType)
          .map((r) => r.resourceId),
      ),
    [refs, resourceType],
  );

  const handleAdd = useCallback(
    async (resourceId: string) => {
      setBusy(resourceId);
      try {
        await addAgentRef(agentId, { resourceType, resourceId }, mutateRefs);
        onAdded?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add");
      } finally {
        setBusy(null);
      }
    },
    [agentId, resourceType, mutateRefs, onAdded],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addFromPoolTitle")}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : poolResources.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noAvailablePoolResources")}
          </p>
        ) : (
          <ScrollArea className="max-h-80 min-h-0">
            <div className="space-y-1 p-1">
              {poolResources.map((r) => {
                const isAdded = existingRefResourceIds.has(r.id);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.key}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {r.origin}
                    </Badge>
                    {isAdded ? (
                      <Button size="sm" variant="ghost" disabled>
                        <CheckIcon className="mr-1 size-3" />
                        {t("alreadyAdded")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => handleAdd(r.id)}
                      >
                        {busy === r.id ? (
                          <Spinner className="mr-1 size-3" />
                        ) : (
                          <PlusIcon className="mr-1 size-3" />
                        )}
                        {t("addFromPool")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
