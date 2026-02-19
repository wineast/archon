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

interface WikiCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, key: string) => Promise<void>;
}

export function WikiCreateDialog({
  open,
  onOpenChange,
  onCreate,
}: WikiCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setTitle(val);
      if (!keyManuallyEdited) {
        setKey(formatKey(val));
      }
    },
    [keyManuallyEdited]
  );

  const handleKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKey(formatKey(e.target.value));
      setKeyManuallyEdited(true);
    },
    []
  );

  const handleCreate = useCallback(async () => {
    if (!title.trim() || !key.trim()) return;
    setCreating(true);
    try {
      await onCreate(title.trim(), key.trim());
      setTitle("");
      setKey("");
      setKeyManuallyEdited(false);
    } finally {
      setCreating(false);
    }
  }, [title, key, onCreate]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTitle("");
        setKey("");
        setKeyManuallyEdited(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const canSubmit = title.trim().length > 0 && key.trim().length > 0 && !creating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Document</DialogTitle>
          <DialogDescription>
            Create a new wiki document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. Getting Started"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Key
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={key}
              onChange={handleKeyChange}
              placeholder="e.g. getting_started"
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
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {creating && <Spinner className="mr-1.5 size-3" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
