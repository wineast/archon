"use client";

import { useCallback, useState } from "react";
import { CheckIcon, PlugIcon, PowerIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { McpServerForm, type McpServerFormHandle } from "./mcp-server-form";
import { testMcpServer } from "@/lib/mcp-servers/hooks";
import type { McpServerRow } from "@/db/schema";

interface McpServerDetailProps {
  mcpServer: McpServerRow;
  onSave: (
    id: string,
    data: {
      name: string;
      description: string;
      url: string;
      transportType: string;
      headers: Record<string, string>;
    }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}

export function McpServerDetail({
  mcpServer,
  onSave,
  onDelete,
  onToggle,
}: McpServerDetailProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [draftRef, setDraftRef] = useState<McpServerFormHandle | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = saving || deleting || testing || toggling;

  const handleSave = useCallback(async () => {
    if (!draftRef) return;
    const draft = draftRef.getDraft();
    setSaving(true);
    try {
      await onSave(mcpServer.id, draft);
    } finally {
      setSaving(false);
    }
  }, [draftRef, onSave, mcpServer.id]);

  const handleReset = useCallback(() => {
    draftRef?.reset();
  }, [draftRef]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(mcpServer.id);
    } finally {
      setDeleting(false);
    }
  }, [mcpServer.id, onDelete]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const result = await testMcpServer(mcpServer.id);
      if (result.ok) {
        toast.success(`Connected! Found ${result.toolCount} tool(s): ${result.tools.join(", ")}`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } finally {
      setTesting(false);
    }
  }, [mcpServer.id]);

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setToggling(true);
      try {
        await onToggle(mcpServer.id, checked);
      } finally {
        setToggling(false);
      }
    },
    [mcpServer.id, onToggle]
  );

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0 overflow-hidden [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-4 space-y-4">
          <McpServerForm
            key={mcpServer.id}
            serverKey={mcpServer.key}
            name={mcpServer.name}
            description={mcpServer.description}
            url={mcpServer.url}
            transportType={mcpServer.transportType}
            headers={mcpServer.headers}
            onDraftRef={setDraftRef}
            onDirtyChange={setDirty}
          />
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          variant={mcpServer.enabled ? "outline" : "ghost"}
          size="sm"
          onClick={() => handleToggle(!mcpServer.enabled)}
          disabled={busy}
        >
          {toggling ? (
            <Spinner className="mr-1 size-3" />
          ) : mcpServer.enabled ? (
            <CheckIcon className="mr-1 size-3" />
          ) : (
            <PowerIcon className="mr-1 size-3" />
          )}
          {mcpServer.enabled ? "Enabled" : "Disabled"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={busy}
        >
          {testing ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <PlugIcon className="mr-1 size-3" />
          )}
          {testing ? "Testing..." : "Test"}
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
          onClick={handleReset}
          disabled={busy || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete MCP Server"
        description={`Are you sure you want to delete "${mcpServer.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
