"use client";

import { use, useCallback, useMemo, useState } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  BracesIcon,
  CodeIcon,
  DatabaseIcon,
  FileIcon,
  FlaskConicalIcon,
  FunctionSquareIcon,
  NetworkIcon,
  PuzzleIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChatConfigPanel } from "@/components/chat-config/chat-config-panel";
import { ToolsPanel } from "@/components/tools/tools-panel";
import { SchemasPanel } from "@/components/schemas/schemas-panel";
import { WikiPanel } from "@/components/wiki/wiki-panel";
import { DatasetsPanel } from "@/components/datasets/datasets-panel";
import { FunctionsPanel } from "@/components/functions/functions-panel";
import { EvalPanel } from "@/components/eval/eval-panel";
import { ModelConfigPanel } from "@/components/model-config/model-config-panel";
import { ComponentsPanel } from "@/components/components/components-panel";
import { MembersPanel } from "@/components/members/members-panel";
import { OntologyPanel } from "@/components/ontology/ontology-panel";
import { VersionsSidebar } from "@/components/versions/versions-sidebar";
import { VersionCreateDialog } from "@/components/versions/version-create-dialog";
import { VersionDetailSheet } from "@/components/versions/version-detail-sheet";
import {
  useVersions,
  createVersion,
  switchVersion,
  publishVersion,
  deleteVersion,
} from "@/lib/versions/hooks";
import { EmbedTokensPanel } from "@/components/embed-tokens/embed-tokens-panel";
import { FilesPanel } from "@/components/agent-files/files-panel";
import { useAgentRole } from "@/lib/auth/hooks";
import { cn } from "@/lib/utils";
import type { AgentRow } from "@/db/schema";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SettingsTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

const SETTINGS_TABS: SettingsTab[] = [
  { value: "config", label: "Config", icon: SlidersHorizontalIcon },
  { value: "tools", label: "Tools", icon: WrenchIcon },
  { value: "components", label: "Components", icon: PuzzleIcon },
  { value: "schemas", label: "Schemas", icon: BracesIcon },
  { value: "wiki", label: "Wiki", icon: BookOpenIcon },
  { value: "datasets", label: "Datasets", icon: DatabaseIcon },
  { value: "ontology", label: "Ontology", icon: NetworkIcon },
  { value: "functions", label: "Functions", icon: FunctionSquareIcon },
  { value: "files", label: "Files", icon: FileIcon },
  { value: "eval", label: "Evaluate", icon: FlaskConicalIcon },
  { value: "model-config", label: "Model Config", icon: SettingsIcon },
  { value: "embed", label: "Embed", icon: CodeIcon },
  { value: "members", label: "Members", icon: UsersIcon },
];

function SettingsContent({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "config";
  const { mutate: globalMutate } = useSWRConfig();

  const {
    canEdit,
    canManageMembers,
    isLoading: roleLoading,
  } = useAgentRole(agent.id);

  // ── Agent data (refreshable) ──
  const { data: agentData, mutate: mutateAgent } = useSWR<AgentRow>(
    `/api/agents/${agent.id}`,
    fetcher
  );
  const currentAgent = agentData ?? agent;
  const currentVersion = currentAgent.version ?? "0.0.0";
  const editingVersionId = currentAgent.editingVersionId ?? null;
  const publishedVersionId = currentAgent.publishedVersionId ?? null;

  // ── Versions ──
  const { versions, mutate: mutateVersions } = useVersions(agent.id);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sheetVersionId, setSheetVersionId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const visibleTabs = useMemo(
    () =>
      SETTINGS_TABS.filter((t) => {
        if (t.value === "members") return canManageMembers;
        return true;
      }),
    [canManageMembers]
  );

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "config") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      const qs = params.toString();
      router.replace(`/${agent.slug}/build${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [searchParams, router, agent.slug]
  );

  // Revalidate only resource SWR caches after version switch.
  // Exclude agent/role/versions/members to avoid full-page re-render.
  const revalidateResources = useCallback(() => {
    const id = agent.id;
    globalMutate(
      (key) => {
        if (typeof key !== "string") return false;
        // Resource APIs use ?agentId=UUID pattern
        if (key.includes(`agentId=${id}`)) return true;
        // Skip: /api/agents/UUID, /api/agents/UUID/role, /api/agents/UUID/versions, /api/agents/UUID/members
        return false;
      },
      undefined,
      { revalidate: true }
    );
  }, [globalMutate, agent.id]);

  // ── Version callbacks ──

  const handleCreate = useCallback(
    async (version: string, changelog: string) => {
      const result = await createVersion(
        agent.id,
        { version, changelog },
        mutateVersions
      );
      if (result?.id) {
        setCreateDialogOpen(false);
        mutateAgent();
      }
    },
    [agent.id, mutateVersions, mutateAgent]
  );

  const handleSwitch = useCallback(
    async (versionId: string) => {
      if (switching || editingVersionId === versionId) return;
      setSwitching(true);
      const ok = await switchVersion(agent.id, versionId, revalidateResources);
      if (ok) {
        mutateAgent();
      }
      setSwitching(false);
    },
    [agent.id, editingVersionId, switching, revalidateResources, mutateAgent]
  );

  const handlePublish = useCallback(
    async (versionId: string) => {
      await publishVersion(agent.id, versionId, mutateVersions);
      mutateAgent();
    },
    [agent.id, mutateVersions, mutateAgent]
  );

  const handleDelete = useCallback(
    async (versionId: string) => {
      await deleteVersion(agent.id, versionId, mutateVersions);
      if (sheetVersionId === versionId) setSheetVersionId(null);
    },
    [agent.id, mutateVersions, sheetVersionId]
  );

  if (roleLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!canEdit) {
    notFound();
  }

  function renderPanel() {
    switch (activeTab) {
      case "config":
        return <ChatConfigPanel agentId={agent.id} />;
      case "tools":
        return <ToolsPanel agentId={agent.id} />;
      case "components":
        return <ComponentsPanel agentId={agent.id} />;
      case "schemas":
        return <SchemasPanel agentId={agent.id} />;
      case "wiki":
        return <WikiPanel agentId={agent.id} />;
      case "datasets":
        return <DatasetsPanel agentId={agent.id} />;
      case "ontology":
        return <OntologyPanel agentId={agent.id} />;
      case "functions":
        return <FunctionsPanel agentId={agent.id} />;
      case "files":
        return <FilesPanel agentId={agent.id} />;
      case "eval":
        return <EvalPanel agentId={agent.id} />;
      case "model-config":
        return <ModelConfigPanel agentId={agent.id} />;
      case "embed":
        return <EmbedTokensPanel agentId={agent.id} />;
      case "members":
        return canManageMembers ? (
          <MembersPanel agentId={agent.id} isPublic={agent.isPublic} />
        ) : null;
      default:
        return <ChatConfigPanel agentId={agent.id} />;
    }
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link href={`/${agent.slug}/chat`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <span className="text-sm font-medium">
          {agent.name}
          <span className="text-muted-foreground"> · 设置</span>
        </span>
        <div className="ml-auto">
          <UserButton />
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Versions sidebar — far left, admin+ only */}
        {canManageMembers && (
          <div className="hidden shrink-0 sm:block">
            <VersionsSidebar
              versions={versions}
              currentVersion={currentVersion}
              editingVersionId={editingVersionId}
              publishedVersionId={publishedVersionId}
              onSelect={handleSwitch}
              onCreate={() => setCreateDialogOpen(true)}
              onViewDetail={(id) => setSheetVersionId(id)}
              onPublish={handlePublish}
              onRollback={() => {}}
              onDelete={handleDelete}
            />
          </div>
        )}

        {/* Desktop settings nav */}
        <nav className="hidden w-48 shrink-0 flex-col gap-1 border-r p-2 sm:flex">
          {visibleTabs.map((t) => {
            const isActive = t.value === activeTab;
            return (
              <button
                key={t.value}
                onClick={() => handleTabChange(t.value)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent text-foreground font-medium"
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile horizontal tabs */}
        <div className="flex shrink-0 overflow-x-auto border-b sm:hidden">
          {visibleTabs.map((t) => {
            const isActive = t.value === activeTab;
            return (
              <button
                key={t.value}
                onClick={() => handleTabChange(t.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground whitespace-nowrap transition-colors",
                  isActive && "border-foreground text-foreground font-medium"
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content — always the normal editable panels */}
        <div className="min-h-0 flex-1 overflow-hidden relative">
          {switching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <Spinner className="size-6" />
            </div>
          )}
          {renderPanel()}
        </div>
      </div>

      {/* ── Dialogs ── */}

      {canManageMembers && (
        <VersionCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreate={handleCreate}
          currentVersion={currentVersion}
        />
      )}

      {sheetVersionId && (
        <VersionDetailSheet
          agentId={agent.id}
          versionId={sheetVersionId}
          open={sheetVersionId !== null}
          onOpenChange={(open) => {
            if (!open) setSheetVersionId(null);
          }}
        />
      )}
    </div>
  );
}

export default function AgentSettingsPage({
  params,
}: {
  params: Promise<{ agentSlug: string }>;
}) {
  const { agentSlug } = use(params);

  const { data: agent, isLoading } = useSWR<AgentRow>(
    `/api/agents/${agentSlug}?by=slug`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!agent || !agent.id) {
    notFound();
  }

  return <SettingsContent agent={agent} />;
}
