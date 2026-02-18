"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { PlusIcon, ShieldIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentFormDialog } from "@/components/agents/agent-form-dialog";
import { useAgents, deleteAgent } from "@/lib/agents/hooks";
import type { AgentWithRole } from "@/lib/agents/hooks";
import type { AgentRow } from "@/db/schema";
import { useCurrentUser } from "@/lib/auth/hooks";

export default function AgentsPage() {
  const { agents, isLoading, mutate } = useAgents();
  const { isSuperAdmin } = useCurrentUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);

  const handleCreate = useCallback(() => {
    setEditingAgent(null);
    setSheetOpen(true);
  }, []);

  const handleEdit = useCallback((agent: AgentWithRole) => {
    setEditingAgent(agent);
    setSheetOpen(true);
  }, []);

  const handleDelete = useCallback(
    (agent: AgentWithRole) => {
      deleteAgent(agent.id, mutate);
    },
    [mutate]
  );

  return (
    <div className="flex min-h-svh flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <h1 className="text-lg font-semibold">Agents</h1>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Link href="/admin">
              <Button size="sm" variant="outline">
                <ShieldIcon className="size-4" />
                管理后台
              </Button>
            </Link>
          )}
          <Button size="sm" onClick={handleCreate}>
            <PlusIcon className="size-4" />
            新建 Agent
          </Button>
          <UserMenu />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner className="size-6" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p className="text-muted-foreground">还没有 Agent</p>
            <Button onClick={handleCreate}>
              <PlusIcon className="size-4" />
              创建第一个 Agent
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Form Dialog */}
      <AgentFormDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        agent={editingAgent}
        mutate={mutate}
      />
    </div>
  );
}
