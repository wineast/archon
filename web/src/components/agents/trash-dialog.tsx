"use client";

import { useCallback, useState } from "react";
import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AGENT_ICON_MAP } from "./icon-picker";
import {
  useTrashAgents,
  restoreAgent,
  permanentDeleteAgent,
} from "@/lib/agents/hooks";
import type { AgentWithRole } from "@/lib/agents/hooks";
import type { AgentRow } from "@/db/schema";
import type { KeyedMutator } from "swr";

interface TrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentsMutate: KeyedMutator<AgentWithRole[]>;
}

export function TrashDialog({
  open,
  onOpenChange,
  agentsMutate,
}: TrashDialogProps) {
  const { agents, isLoading, mutate: trashMutate } = useTrashAgents();
  const [busy, setBusy] = useState(false);
  const [confirmAgent, setConfirmAgent] = useState<AgentRow | null>(null);

  const handleRestore = useCallback(
    async (agent: AgentRow) => {
      setBusy(true);
      await restoreAgent(agent.id, trashMutate, agentsMutate);
      setBusy(false);
    },
    [trashMutate, agentsMutate]
  );

  const handlePermanentDelete = useCallback(async () => {
    if (!confirmAgent) return;
    setBusy(true);
    await permanentDeleteAgent(confirmAgent.id, trashMutate);
    setConfirmAgent(null);
    setBusy(false);
  }, [confirmAgent, trashMutate]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>回收站</DialogTitle>
            <DialogDescription>已删除的 Agent，可恢复或永久删除</DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5" />
              </div>
            ) : agents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                回收站为空
              </p>
            ) : (
              <div className="space-y-2">
                {agents.map((agent) => {
                  const Icon =
                    AGENT_ICON_MAP[agent.icon] ?? AGENT_ICON_MAP["bot"];
                  return (
                    <div
                      key={agent.id}
                      className="flex items-center gap-3 rounded-md border p-3"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {agent.name}
                        </p>
                        {agent.deletedAt && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(agent.deletedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={busy}
                          onClick={() => handleRestore(agent)}
                          title="恢复"
                        >
                          {busy ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <RotateCcwIcon className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          disabled={busy}
                          onClick={() => setConfirmAgent(agent)}
                          title="永久删除"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm permanent delete */}
      <Dialog
        open={confirmAgent !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmAgent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>永久删除</DialogTitle>
            <DialogDescription>
              确定永久删除 <strong>{confirmAgent?.name}</strong>
              ？此操作不可撤销，所有关联数据将被清除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAgent(null)}
              disabled={busy}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={busy}
            >
              {busy ? <Spinner className="size-4" /> : "永久删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
