"use client";

import { use, useCallback, useMemo } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  FunctionSquareIcon,
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
import { WikiPanel } from "@/components/wiki/wiki-panel";
import { DatasetsPanel } from "@/components/datasets/datasets-panel";
import { FunctionsPanel } from "@/components/functions/functions-panel";
import { EvalPanel } from "@/components/eval/eval-panel";
import { ModelConfigPanel } from "@/components/model-config/model-config-panel";
import { ComponentsPanel } from "@/components/components/components-panel";
import { MembersPanel } from "@/components/members/members-panel";
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
  { value: "wiki", label: "Wiki", icon: BookOpenIcon },
  { value: "datasets", label: "Datasets", icon: DatabaseIcon },
  { value: "functions", label: "Functions", icon: FunctionSquareIcon },
  { value: "eval", label: "Evaluate", icon: FlaskConicalIcon },
  { value: "model-config", label: "Model Config", icon: SettingsIcon },
  { value: "members", label: "Members", icon: UsersIcon },
];

function SettingsContent({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "config";

  const { canEdit, canManageMembers, isLoading: roleLoading } = useAgentRole(agent.id);

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
      router.replace(`/${agent.slug}/settings${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [searchParams, router, agent.slug]
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
      case "wiki":
        return <WikiPanel agentId={agent.id} />;
      case "datasets":
        return <DatasetsPanel agentId={agent.id} />;
      case "functions":
        return <FunctionsPanel agentId={agent.id} />;
      case "eval":
        return <EvalPanel agentId={agent.id} />;
      case "model-config":
        return <ModelConfigPanel agentId={agent.id} />;
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
          <span className="text-muted-foreground"> · 设置</span>
        </span>
        <div className="ml-auto">
          <UserButton />
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Desktop sidebar */}
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

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {renderPanel()}
        </div>
      </div>
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
