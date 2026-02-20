"use client";

import { useCallback, useState } from "react";
import {
  CodeIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { GuideDialog } from "@/components/ui/guide-dialog";
import embedGuide from "../../../guide/embed-widget.md";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useEmbedTokens,
  createEmbedToken,
  updateEmbedToken,
  deleteEmbedToken,
} from "@/lib/embed-tokens/hooks";
import { EmbedCodeDialog } from "./embed-code-dialog";
import type { EmbedTokenRow } from "@/db/schema";

interface EmbedTokensPanelProps {
  agentId: string;
}

export function EmbedTokensPanel({ agentId }: EmbedTokensPanelProps) {
  const { tokens, isLoading, mutate } = useEmbedTokens(agentId);
  const [busy, setBusy] = useState(false);

  // Create token form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOrigins, setNewOrigins] = useState("");

  // Embed code dialog
  const [codeToken, setCodeToken] = useState<EmbedTokenRow | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<EmbedTokenRow | null>(null);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const origins = newOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await createEmbedToken(
      agentId,
      { name: newName.trim(), allowedOrigins: origins },
      mutate
    );
    if (result) {
      setNewName("");
      setNewOrigins("");
      setShowCreate(false);
    }
    setBusy(false);
  }, [agentId, newName, newOrigins, mutate]);

  const handleToggleActive = useCallback(
    async (token: EmbedTokenRow) => {
      setBusy(true);
      await updateEmbedToken(
        agentId,
        token.id,
        { isActive: !token.isActive },
        mutate
      );
      setBusy(false);
    },
    [agentId, mutate]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteEmbedToken(agentId, deleteTarget.id, mutate);
    setDeleteTarget(null);
  }, [agentId, deleteTarget, mutate]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-sm font-semibold">Embed</span>
        <GuideDialog title="嵌入部署" content={embedGuide} />
        <div className="flex-1" />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            Create tokens to embed this agent as a chat widget on external websites.
          </p>

          {tokens.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground">
              No embed tokens yet. Create one to get started.
            </p>
          )}

          {/* Token list */}
          <div className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{token.name}</span>
                    <Badge variant={token.isActive ? "default" : "secondary"}>
                      {token.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {token.token}
                  </p>
                  {token.allowedOrigins.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Origins: {token.allowedOrigins.join(", ")}
                    </p>
                  )}
                  {token.lastUsedAt && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Last used: {new Date(token.lastUsedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch
                    checked={token.isActive}
                    onCheckedChange={() => handleToggleActive(token)}
                    disabled={busy}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setCodeToken(token)}
                    disabled={busy}
                  >
                    <CodeIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => setDeleteTarget(token)}
                    disabled={busy}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="space-y-3 rounded-md border p-3">
              <Input
                placeholder="Token name (e.g. Production)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="Allowed origins (comma-separated, leave empty for any)"
                value={newOrigins}
                onChange={(e) => setNewOrigins(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={busy || !newName.trim()}>
                  {busy ? <Spinner className="size-4" /> : "Create"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setNewName("");
                    setNewOrigins("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom action */}
      <div className="shrink-0 border-t p-4">
        <Button
          size="sm"
          onClick={() => setShowCreate(true)}
          disabled={showCreate}
        >
          <PlusIcon className="mr-1 size-4" />
          New Token
        </Button>
      </div>

      {/* Embed code dialog */}
      {codeToken && (
        <EmbedCodeDialog
          open={!!codeToken}
          onOpenChange={(open) => !open && setCodeToken(null)}
          agentId={agentId}
          token={codeToken.token}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Token"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Any websites using this token will no longer be able to access the chat.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
