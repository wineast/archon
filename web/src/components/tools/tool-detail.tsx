"use client";

import { useCallback, useRef, useState } from "react";
import { CheckIcon, PowerIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToolForm, type ToolFormHandle } from "./tool-form";
import type { ToolRow } from "@/db/schema";
import type { ToolDefinition } from "@/lib/tools/types";

interface ToolDetailProps {
  tool: ToolRow;
  agentId?: string;
  onSave: (updated: ToolDefinition) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}

export function ToolDetail({ tool, agentId, onSave, onDelete, onToggle }: ToolDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const draftRef = useRef<ToolFormHandle | null>(null);
  const handleDraftRef = useCallback((ref: ToolFormHandle) => {
    draftRef.current = ref;
  }, []);
  const [dirty, setDirty] = useState(false);
  const busy = saving || deleting || toggling;

  const handleSave = useCallback(async () => {
    if (!draftRef.current) return;
    const draft = draftRef.current.getDraft();
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(tool.id);
    } finally {
      setDeleting(false);
    }
  }, [tool.id, onDelete]);

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setToggling(true);
      try {
        await onToggle(tool.id, checked);
      } finally {
        setToggling(false);
      }
    },
    [tool.id, onToggle]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Form body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-4">
          <ToolForm
            tool={{
              id: tool.id,
              key: tool.key,
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              returnParameters: tool.returnParameters ?? [],
              output: tool.output ?? "{}",
              handler: tool.handler ?? "",
              component: tool.component ?? "",
              componentSource: tool.componentSource ?? "",
              componentMockData: tool.componentMockData ?? "",
              enabled: tool.enabled,
            }}
            agentId={agentId}
            onDraftRef={handleDraftRef}
            onDirtyChange={setDirty}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          variant={tool.enabled ? "outline" : "ghost"}
          size="sm"
          onClick={() => handleToggle(!tool.enabled)}
          disabled={busy}
        >
          {toggling ? (
            <Spinner className="mr-1 size-3" />
          ) : tool.enabled ? (
            <CheckIcon className="mr-1 size-3" />
          ) : (
            <PowerIcon className="mr-1 size-3" />
          )}
          {tool.enabled ? "Enabled" : "Disabled"}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy || !dirty}
        >
          {saving ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <SaveIcon className="mr-1 size-3" />
          )}
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => draftRef.current?.reset()}
          disabled={busy || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={busy}
        >
          {deleting ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <Trash2Icon className="mr-1 size-3" />
          )}
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
}
