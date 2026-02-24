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
import { Textarea } from "@/components/ui/textarea";
import type { UIMessage } from "ai";
import type { EvalTurn } from "@/lib/eval/types";
import { parseUIMessagesToTurns } from "@/lib/eval/import-turns";

interface ImportTurnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (turns: EvalTurn[]) => void;
  hasExistingTurns: boolean;
}

export function ImportTurnsDialog({
  open,
  onOpenChange,
  onImport,
  hasExistingTurns,
}: ImportTurnsDialogProps) {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback(() => {
    setError(null);
    try {
      const parsed = JSON.parse(json.trim()) as unknown;
      if (!Array.isArray(parsed)) {
        setError("JSON must be an array of UIMessage objects.");
        return;
      }
      const turns = parseUIMessagesToTurns(parsed as UIMessage[]);
      if (turns.length === 0) {
        setError("No valid user/assistant messages found.");
        return;
      }
      onImport(turns);
      setJson("");
      setError(null);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof SyntaxError ? "Invalid JSON." : String(e));
    }
  }, [json, onImport, onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setJson("");
        setError(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Turns</DialogTitle>
          <DialogDescription>
            Paste UIMessage[] JSON from Request Inspector &gt; Messages tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            className="min-h-[200px] max-h-[50vh] resize-none font-mono text-xs"
            value={json}
            onChange={(e) => {
              setJson(e.target.value);
              setError(null);
            }}
            placeholder='[{"id":"...","role":"user","parts":[...]}]'
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          {hasExistingTurns && (
            <p className="text-xs text-muted-foreground">
              Importing will replace all existing turns.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!json.trim()}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
