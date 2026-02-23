"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PlusIcon, SettingsIcon, ShieldIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AgentCard } from "@/components/agents/agent-card";
import { AgentFormDialog } from "@/components/agents/agent-form-dialog";
import { TrashDialog } from "@/components/agents/trash-dialog";
import { OrgSwitcher } from "@/components/orgs/org-switcher";
import { OrgFormDialog } from "@/components/orgs/org-form-dialog";
import { useAgents, deleteAgent, exportAgent, importAgent } from "@/lib/agents/hooks";
import type { AgentWithRole } from "@/lib/agents/hooks";
import { useOrgs, useOrgParam } from "@/lib/orgs/hooks";
import type { AgentRow } from "@/db/schema";
import { useCurrentUser, useOrgRole } from "@/lib/auth/hooks";
import { useOrgStore } from "@/stores/org-store";
export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-svh items-center justify-center"><Spinner className="size-6" /></div>}>
      <AgentsPageContent />
    </Suspense>
  );
}

function AgentsPageContent() {
  const t = useTranslations("agent");
  const tn = useTranslations("nav");
  const { currentOrgId } = useOrgStore();
  const { orgs, mutate: mutateOrgs } = useOrgs();
  useOrgParam(orgs);
  const { agents, isLoading, mutate } = useAgents(currentOrgId ?? undefined);
  const { isSuperAdmin } = useCurrentUser();
  const { canManage } = useOrgRole(currentOrgId ?? undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentRow | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const currentOrg = orgs.find((o) => o.id === currentOrgId);

  const handleCreate = useCallback(() => {
    setEditingAgent(null);
    setSheetOpen(true);
  }, []);

  const handleEdit = useCallback((agent: AgentWithRole) => {
    setEditingAgent(agent);
    setSheetOpen(true);
  }, []);

  const tc = useTranslations("common");

  const handleDelete = useCallback(
    (agent: AgentWithRole) => {
      deleteAgent(agent.id, mutate, tc);
    },
    [mutate, tc]
  );

  const handleExport = useCallback(
    (agent: AgentWithRole) => {
      exportAgent(agent, t);
    },
    [t]
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!currentOrgId) return;
      setImporting(true);
      try {
        await importAgent(file, currentOrgId, mutate, t);
      } finally {
        setImporting(false);
      }
    },
    [currentOrgId, mutate, t]
  );

  return (
    <div className="flex min-h-svh flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{tn("agents")}</h1>
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
                {tn("admin")}
              </Button>
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={() => setTrashOpen(true)}>
            <Trash2Icon className="size-4" />
            {tn("trash")}
          </Button>
          {currentOrgId && (
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()} disabled={importing}>
                {importing ? <Spinner className="size-4" /> : <UploadIcon className="size-4" />}
                {t("importAgent")}
              </Button>
              <Button size="sm" onClick={handleCreate}>
                <PlusIcon className="size-4" />
                {t("createNew")}
              </Button>
            </>
          )}
          <LocaleSwitcher />
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
            <p className="text-muted-foreground">{t("noAgents")}</p>
            {currentOrgId && (
              <Button onClick={handleCreate}>
                <PlusIcon className="size-4" />
                {t("createFirst")}
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
                onExport={handleExport}
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

      {/* Trash Dialog */}
      <TrashDialog
        open={trashOpen}
        onOpenChange={setTrashOpen}
        agentsMutate={mutate}
      />

    </div>
  );
}
