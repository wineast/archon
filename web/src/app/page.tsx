"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { PlusIcon, SettingsIcon, ShieldIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentFormDialog } from "@/components/agents/agent-form-dialog";
import { OrgSwitcher } from "@/components/orgs/org-switcher";
import { OrgFormDialog } from "@/components/orgs/org-form-dialog";
import { useAgents, deleteAgent } from "@/lib/agents/hooks";
import type { AgentWithRole } from "@/lib/agents/hooks";
import { useOrgs } from "@/lib/orgs/hooks";
import type { AgentRow } from "@/db/schema";
import { useCurrentUser, useOrgRole } from "@/lib/auth/hooks";
import { useOrgStore } from "@/stores/org-store";

export default function AgentsPage() {
  const { currentOrgId } = useOrgStore();
  const { orgs, mutate: mutateOrgs } = useOrgs();
  const { agents, isLoading, mutate } = useAgents(currentOrgId ?? undefined);
  const { isSuperAdmin } = useCurrentUser();
  const { canManage } = useOrgRole(currentOrgId ?? undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);

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
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Agents</h1>
          <OrgSwitcher onCreateOrg={() => setOrgDialogOpen(true)} />
          {currentOrg && canManage && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/${currentOrg.slug}/settings`}>
                <SettingsIcon className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Link href="/admin">
              <Button size="sm" variant="outline">
                <ShieldIcon className="size-4" />
                管理后台
              </Button>
            </Link>
          )}
          {currentOrgId && (
            <Button size="sm" onClick={handleCreate}>
              <PlusIcon className="size-4" />
              新建 Agent
            </Button>
          )}
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
            {currentOrgId && (
              <Button onClick={handleCreate}>
                <PlusIcon className="size-4" />
                创建第一个 Agent
              </Button>
            )}
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

      {/* Agent Form Dialog */}
      {currentOrgId && (
        <AgentFormDialog
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          agent={editingAgent}
          mutate={mutate}
          orgId={currentOrgId}
        />
      )}

      {/* Org Form Dialog */}
      <OrgFormDialog
        open={orgDialogOpen}
        onOpenChange={setOrgDialogOpen}
        mutate={mutateOrgs}
      />
    </div>
  );
}
