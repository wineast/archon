"use client";

import { useCallback, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

interface VersionCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (version: string, changelog: string) => Promise<void>;
  latestVersion: string | null;
}

function suggestNextPatch(current: string): string {
  const parts = current.split(".").map(Number);
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
  return "1.0.0";
}

export function VersionCreateDialog({
  open,
  onOpenChange,
  onCreate,
  latestVersion,
}: VersionCreateDialogProps) {
  const suggested = useMemo(
    () => (latestVersion ? suggestNextPatch(latestVersion) : "1.0.0"),
    [latestVersion]
  );
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [creating, setCreating] = useState(false);

  const effectiveVersion = version || suggested;

  const handleCreate = useCallback(async () => {
    if (!effectiveVersion.trim()) return;
    setCreating(true);
    try {
      await onCreate(effectiveVersion.trim(), changelog.trim());
      setVersion("");
      setChangelog("");
    } finally {
      setCreating(false);
    }
  }, [effectiveVersion, changelog, onCreate]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setVersion("");
        setChangelog("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const isValid = /^\d+\.\d+\.\d+$/.test(effectiveVersion);
  const canSubmit = isValid && !creating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Version</DialogTitle>
          <DialogDescription>
            Create a snapshot of the current agent configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Version
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder={suggested}
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">
              SemVer format (e.g. 1.0.0)
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Changelog
            </label>
            <Textarea
              className="mt-1 text-sm"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              placeholder="Describe what changed in this version..."
              rows={4}
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
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
