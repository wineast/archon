"use client";

import { useCallback, useState } from "react";
import { CheckIcon, PlugIcon, PowerIcon, RotateCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { McpServerForm, type McpServerFormHandle } from "./mcp-server-form";
import { testMcpServer, type McpToolDef } from "@/lib/mcp-servers/hooks";
import { McpToolPlayground } from "./mcp-tool-playground";
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
  const [playgroundTools, setPlaygroundTools] = useState<McpToolDef[]>([]);
  const [playgroundConfig, setPlaygroundConfig] = useState<{ url: string; transportType: string; headers: Record<string, string> } | null>(null);
  const [activeTab, setActiveTab] = useState("edit");
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
    if (!draftRef) return;
    setTesting(true);
    try {
      const draft = draftRef.getDraft();
      const config = { url: draft.url, transportType: draft.transportType, headers: draft.headers };
      const result = await testMcpServer(mcpServer.id, config);
      if (result.ok && result.tools) {
        toast.success(`Connected! Found ${result.toolCount} tool(s)`);
        setPlaygroundTools(result.tools);
        setPlaygroundConfig(config);
        setActiveTab("playground");
      } else {
        toast.error(`Connection failed: ${result.error}`);
        setPlaygroundTools([]);
        setPlaygroundConfig(null);
      }
    } finally {
      setTesting(false);
    }
  }, [mcpServer.id, draftRef]);

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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
      <TabsList variant="line" className="shrink-0 px-4 pt-1">
        <TabsTrigger value="edit">Edit</TabsTrigger>
        <TabsTrigger value="playground">Playground</TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex min-h-0 flex-1 flex-col">
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
      </TabsContent>

      <TabsContent value="playground" className="flex min-h-0 flex-1 flex-col">
        {playgroundTools.length > 0 && playgroundConfig ? (
          <McpToolPlayground tools={playgroundTools} serverId={mcpServer.id} connectionConfig={playgroundConfig} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">
              Please click <strong>Test</strong> on the Edit tab to connect to the MCP server first.
            </p>
          </div>
        )}
      </TabsContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete MCP Server"
        description={`Are you sure you want to delete "${mcpServer.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </Tabs>
  );
}
