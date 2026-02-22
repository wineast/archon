"use client";

import { use, useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { notFound, useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import useSWR, { useSWRConfig } from "swr";
import { UserButton } from "@clerk/nextjs";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  BookOpenIcon,
  BrainIcon,
  BracesIcon,
  CodeIcon,
  DatabaseIcon,
  FileIcon,
  FlaskConicalIcon,
  FunctionSquareIcon,
  GavelIcon,
  HistoryIcon,
  MessageSquareIcon,
  NetworkIcon,
  PlugIcon,
  PlugZapIcon,
  PuzzleIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UsersIcon,
  WrenchIcon,
  ZapIcon,
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
import { MemoryPanel } from "@/components/memory/memory-panel";
import { toggleMemoryFeature } from "@/lib/memory/hooks";
import { RagPanel } from "@/components/rag/rag-panel";
import { toggleRagFeature } from "@/lib/rag/hooks";
import { McpServersPanel } from "@/components/mcp-servers/mcp-servers-panel";
import { SkillsPanel } from "@/components/skills/skills-panel";
import { UsagePanel } from "@/components/usage/usage-panel";
import { SessionsPanel } from "@/components/sessions/sessions-panel";
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
import { BuildChatPanel } from "@/components/build-chat/build-chat-panel";
import { AuditLogSheet } from "@/components/audit-log/audit-log-sheet";
import { RuntimeEventsPanel } from "@/components/runtime-events/runtime-events-panel";
import { cn } from "@/lib/utils";
import type { AgentRow } from "@/db/schema";
import { TrashSheet } from "@/components/trash/trash-sheet";
import { useTrash } from "@/lib/trash/hooks";
import { toggleSkillsFeature } from "@/lib/skills/hooks";
import { AgentSlotsPanel } from "@/components/slots/agent-slots-panel";
import { JudgeConfigPanel } from "@/components/judge-config/judge-config-panel";
import { SupportBubble } from "@/components/support-bubble/support-bubble";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SettingsTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

const SETTINGS_TABS: SettingsTab[] = [
  // ── Agent config ──
  { value: "config", label: "config", icon: SlidersHorizontalIcon },
  // ── L0: Foundation (no external deps) ──
  { value: "datasets", label: "datasets", icon: DatabaseIcon },
  { value: "schemas", label: "schemas", icon: BracesIcon },
  // ── L1: Content & logic (depend on L0) ──
  { value: "wiki", label: "wiki", icon: BookOpenIcon },
  { value: "functions", label: "functions", icon: FunctionSquareIcon },
  { value: "components", label: "components", icon: PuzzleIcon },
  { value: "ontology", label: "ontology", icon: NetworkIcon },
  // ── L2: Capabilities (depend on L0 + L1) ──
  { value: "tools", label: "tools", icon: WrenchIcon },
  { value: "skills", label: "skills", icon: ZapIcon },
  // ── L3: Assembly (reference everything above) ──
  { value: "model-config", label: "modelConfig", icon: SettingsIcon },
  { value: "judge", label: "judge", icon: GavelIcon },
  { value: "memory", label: "memory", icon: BrainIcon },
  { value: "rag", label: "rag", icon: SearchIcon },
  { value: "mcp", label: "mcp", icon: PlugIcon },
  { value: "slots", label: "slots", icon: PlugZapIcon },
  // ── Runtime & operations ──
  { value: "files", label: "files", icon: FileIcon },
  { value: "sessions", label: "sessions", icon: MessageSquareIcon },
  { value: "eval", label: "evaluate", icon: FlaskConicalIcon },
  // ── Infrastructure ──
  { value: "embed", label: "embed", icon: CodeIcon },
  { value: "usage", label: "usage", icon: BarChart3Icon },
  { value: "runtime", label: "runtime", icon: ActivityIcon },
  { value: "members", label: "members", icon: UsersIcon },
];

function SettingsContent({ agent, orgSlug }: { agent: AgentRow; orgSlug: string }) {
  const t = useTranslations("build");
  const tn = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "config";
  const { mutate: globalMutate } = useSWRConfig();

  const basePath = `/${orgSlug}/${agent.slug}`;

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
  const editingVersionId = currentAgent.editingVersionId ?? null;
  const publishedVersionId = currentAgent.publishedVersionId ?? null;

  // ── Versions ──
  const { versions, mutate: mutateVersions } = useVersions(agent.id);
  const latestVersion = versions[0]?.version ?? null;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sheetVersionId, setSheetVersionId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const { totalCount: trashCount } = useTrash(agent.id);

  const handleToggleSkills = useCallback(
    async (enabled: boolean) => {
      await toggleSkillsFeature(agent.id, enabled, mutateAgent);
    },
    [agent.id, mutateAgent]
  );

  const visibleTabs = useMemo(
    () =>
      SETTINGS_TABS.filter((tab) => {
        if (tab.value === "members" || tab.value === "usage" || tab.value === "runtime") return canManageMembers;
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
      router.replace(`${basePath}/build${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [searchParams, router, basePath]
  );

  // Revalidate only resource SWR caches after version switch.
  const revalidateResources = useCallback(() => {
    const id = agent.id;
    globalMutate(
      (key) => {
        if (typeof key !== "string") return false;
        if (key.includes(`agentId=${id}`)) return true;
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

  const handleToggleMemory = useCallback(
    async (enabled: boolean) => {
      await toggleMemoryFeature(agent.id, enabled, mutateAgent);
    },
    [agent.id, mutateAgent]
  );

  const handleToggleRag = useCallback(
    async (enabled: boolean) => {
      await toggleRagFeature(agent.id, enabled, mutateAgent);
    },
    [agent.id, mutateAgent]
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
        return <ToolsPanel agentId={agent.id} skillsEnabled={currentAgent.skillsEnabled} />;
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
      case "memory":
        return (
          <MemoryPanel
            agentId={agent.id}
            memoryEnabled={currentAgent.memoryEnabled}
            onToggleFeature={handleToggleMemory}
          />
        );
      case "rag":
        return (
          <RagPanel
            agentId={agent.id}
            ragEnabled={currentAgent.ragEnabled}
            onToggleFeature={handleToggleRag}
          />
        );
      case "mcp":
        return <McpServersPanel agentId={agent.id} />;
      case "functions":
        return <FunctionsPanel agentId={agent.id} />;
      case "skills":
        return (
          <SkillsPanel
            agentId={agent.id}
            skillsEnabled={currentAgent.skillsEnabled}
            onToggleFeature={handleToggleSkills}
          />
        );
      case "files":
        return <FilesPanel agentId={agent.id} />;
      case "sessions":
        return <SessionsPanel agentId={agent.id} />;
      case "eval":
        return <EvalPanel agentId={agent.id} />;
      case "model-config":
        return <ModelConfigPanel agentId={agent.id} />;
      case "judge":
        return <JudgeConfigPanel agentId={agent.id} />;
      case "embed":
        return <EmbedTokensPanel agentId={agent.id} />;
      case "usage":
        return canManageMembers ? <UsagePanel agentId={agent.id} /> : null;
      case "runtime":
        return canManageMembers ? <RuntimeEventsPanel agentId={agent.id} /> : null;
      case "slots":
        return <AgentSlotsPanel agentId={agent.id} orgId={agent.orgId} />;
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
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <span className="text-sm font-medium">
          {agent.name}
          <span className="text-muted-foreground"> {t("titleSuffix")}</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={chatOpen ? "secondary" : "ghost"}
            size="icon"
            className="size-8"
            onClick={() => setChatOpen((v) => !v)}
          >
            <MessageSquareIcon className="size-4" />
          </Button>
          <UserButton />
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Build Chat panel — far left, toggleable */}
        {chatOpen && (
          <div className="hidden shrink-0 sm:block">
            <BuildChatPanel agentId={agent.id} />
          </div>
        )}

        {/* Versions sidebar — admin+ only */}
        {canManageMembers && (
          <div className="hidden shrink-0 sm:block">
            <VersionsSidebar
              versions={versions}
              latestVersion={latestVersion}
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
        <nav className="hidden w-48 shrink-0 flex-col border-r p-2 sm:flex">
          {visibleTabs.map((tab) => {
            const isActive = tab.value === activeTab;
            const showOff = (tab.value === "mcp" && currentAgent.mcpEnabled === false) || (tab.value === "memory" && !currentAgent.memoryEnabled) || (tab.value === "rag" && !currentAgent.ragEnabled) || (tab.value === "skills" && !currentAgent.skillsEnabled);
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  isActive && "bg-accent text-foreground font-medium"
                )}
              >
                <tab.icon className="size-4" />
                {t(tab.label)}
                {showOff && (
                  <span className="ml-auto text-[10px] text-muted-foreground/60">{t("disabledBadge")}</span>
                )}
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            onClick={() => setTrashOpen(true)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Trash2Icon className="size-4" />
            {tn("trash")}
            {trashCount > 0 && (
              <span className="ml-auto rounded-full bg-muted px-1.5 text-xs">
                {trashCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setAuditLogOpen(true)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HistoryIcon className="size-4" />
            {t("auditLog")}
          </button>
        </nav>

        {/* Mobile horizontal tabs */}
        <div className="flex shrink-0 overflow-x-auto border-b sm:hidden">
          {visibleTabs.map((tab) => {
            const isActive = tab.value === activeTab;
            const showOff = (tab.value === "mcp" && currentAgent.mcpEnabled === false) || (tab.value === "memory" && !currentAgent.memoryEnabled) || (tab.value === "rag" && !currentAgent.ragEnabled) || (tab.value === "skills" && !currentAgent.skillsEnabled);
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground whitespace-nowrap transition-colors",
                  isActive && "border-foreground text-foreground font-medium"
                )}
              >
                <tab.icon className="size-3.5" />
                {t(tab.label)}
                {showOff && (
                  <span className="ml-1 text-[10px] text-muted-foreground/60">{t("disabledBadge")}</span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setTrashOpen(true)}
            className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground whitespace-nowrap transition-colors"
          >
            <Trash2Icon className="size-3.5" />
            {tn("trash")}
            {trashCount > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
                {trashCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setAuditLogOpen(true)}
            className="flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground whitespace-nowrap transition-colors"
          >
            <HistoryIcon className="size-3.5" />
            {t("auditLog")}
          </button>
        </div>

        {/* Content */}
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
          latestVersion={latestVersion}
        />
      )}

      <TrashSheet
        agentId={agent.id}
        open={trashOpen}
        onOpenChange={setTrashOpen}
      />

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

      <AuditLogSheet
        agentId={agent.id}
        open={auditLogOpen}
        onOpenChange={setAuditLogOpen}
      />

      <SupportBubble />
    </div>
  );
}

export default function AgentSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; agentSlug: string }>;
}) {
  const { orgSlug, agentSlug } = use(params);

  const { data: agent, isLoading } = useSWR<AgentRow>(
    `/api/agents/by-slug?org=${orgSlug}&agent=${agentSlug}`,
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

  return <SettingsContent agent={agent} orgSlug={orgSlug} />;
}
