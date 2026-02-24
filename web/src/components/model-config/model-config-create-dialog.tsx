"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

function formatKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function keyToName(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface ModelConfigCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (key: string, name: string) => Promise<void>;
}

export function ModelConfigCreateDialog({
  open,
  onOpenChange,
  onCreate,
}: ModelConfigCreateDialogProps) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatKey(e.target.value);
      setKey(formatted);
      if (!nameManuallyEdited) {
        setName(keyToName(formatted));
      }
    },
    [nameManuallyEdited]
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
      setNameManuallyEdited(true);
    },
    []
  );

  const handleCreate = useCallback(async () => {
    if (!key.trim()) return;
    setCreating(true);
    try {
      await onCreate(key.trim(), name.trim() || keyToName(key.trim()));
      setKey("");
      setName("");
      setNameManuallyEdited(false);
    } finally {
      setCreating(false);
    }
  }, [key, name, onCreate]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setKey("");
        setName("");
        setNameManuallyEdited(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const canSubmit = key.trim().length > 0 && !creating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Model Config</DialogTitle>
          <DialogDescription>
            Create a new model configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Key
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={key}
              onChange={handleKeyChange}
              placeholder="e.g. gpt4_turbo"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Gpt4 Turbo"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit} data-testid="btn-create-config">
            {creating && <Spinner className="mr-1.5 size-3" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
