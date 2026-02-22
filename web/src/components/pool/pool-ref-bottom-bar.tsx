"use client";

import { useCallback, useState } from "react";
import { CheckIcon, PowerIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { removeAgentRef, toggleAgentRef, useAgentRefs } from "@/lib/pool/ref-hooks";
import type { ResourceType } from "@/db/schema";
import { toast } from "sonner";

interface PoolRefBottomBarProps {
  agentId: string;
  refId: string;
  resourceType: ResourceType;
  enabled?: boolean;
  onRemoved: () => void;
  onToggled?: (enabled: boolean) => void;
}

export function PoolRefBottomBar({
  agentId,
  refId,
  resourceType,
  enabled,
  onRemoved,
  onToggled,
}: PoolRefBottomBarProps) {
  const { mutate: mutateRefs } = useAgentRefs(agentId);
  const [removing, setRemoving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = removing || toggling;

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      await removeAgentRef(agentId, refId, mutateRefs);
      onRemoved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove reference");
    } finally {
      setRemoving(false);
    }
  }, [agentId, refId, mutateRefs, onRemoved]);

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setToggling(true);
      try {
        await toggleAgentRef(agentId, refId, checked, mutateRefs);
        onToggled?.(checked);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to toggle reference");
      } finally {
        setToggling(false);
      }
    },
    [agentId, refId, mutateRefs, onToggled],
  );

  return (
    <>
      <div className="flex items-center gap-2 border-t px-4 py-2">
        {resourceType === "tool" && enabled !== undefined && (
          <div className="flex items-center gap-1.5">
            {toggling ? (
              <Spinner className="size-3" />
            ) : enabled ? (
              <CheckIcon className="size-3 text-muted-foreground" />
            ) : (
              <PowerIcon className="size-3 text-muted-foreground" />
            )}
            <Switch
              className="scale-75"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={busy}
            />
            <span className="text-xs text-muted-foreground">
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        )}
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          {removing ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <Trash2Icon className="mr-1 size-3" />
          )}
          {removing ? "Removing..." : "移除引用"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="移除引用"
        description="确定要移除对该资源的引用吗？移除后 Agent 将不再使用此资源。"
        confirmLabel="移除"
        onConfirm={handleRemove}
      />
    </>
  );
}
