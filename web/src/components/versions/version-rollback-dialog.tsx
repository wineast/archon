"use client";

import { useCallback, useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { AgentSnapshot } from "@/lib/versions/types";

interface VersionRollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  version: string;
  snapshot: AgentSnapshot | null;
}

function snapshotSummary(snapshot: AgentSnapshot) {
  return [
    { label: "Tools", count: snapshot.tools.length },
    { label: "Functions", count: snapshot.functions.length },
    { label: "Components", count: snapshot.components.length },
    { label: "Schemas", count: snapshot.schemas.length },
    { label: "Wiki Documents", count: snapshot.wikiDocuments.length },
    { label: "Datasets", count: snapshot.datasets.length },
    { label: "Model Configs", count: snapshot.modelConfigs.length },
    { label: "Chat Config", count: snapshot.chatConfig ? 1 : 0 },
    { label: "Eval Cases", count: snapshot.evalCases.length },
    { label: "Judge Configs", count: snapshot.evalJudgeConfigs.length },
  ];
}

export function VersionRollbackDialog({
  open,
  onOpenChange,
  onConfirm,
  version,
  snapshot,
}: VersionRollbackDialogProps) {
  const [rolling, setRolling] = useState(false);

  const handleConfirm = useCallback(async () => {
    setRolling(true);
    try {
      await onConfirm();
    } finally {
      setRolling(false);
    }
  }, [onConfirm]);

  const summary = snapshot ? snapshotSummary(snapshot) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-amber-500" />
            Rollback to v{version}
          </DialogTitle>
          <DialogDescription>
            This will replace all current agent configuration with the snapshot
            from version {version}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {snapshot && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Snapshot Contents
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {summary.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={rolling}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={rolling}
          >
            {rolling && <Spinner className="mr-1.5 size-3" />}
            Rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
