"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EllipsisVerticalIcon, PencilIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AGENT_ICON_MAP } from "./icon-picker";
import type { AgentWithRole } from "@/lib/agents/hooks";
import { AGENT_ROLE_LEVELS } from "@/db/schema";

interface AgentCardProps {
  agent: AgentWithRole;
  onEdit: (agent: AgentWithRole) => void;
  onDelete: (agent: AgentWithRole) => void;
}

export function AgentCard({ agent, onEdit, onDelete }: AgentCardProps) {
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const level = agent.myRole ? AGENT_ROLE_LEVELS[agent.myRole] : -1;
  const canEdit = level >= AGENT_ROLE_LEVELS.admin;
  const canDelete = level >= AGENT_ROLE_LEVELS.owner;
  const Icon = AGENT_ICON_MAP[agent.icon] ?? AGENT_ICON_MAP["bot"];

  const orgSlug = agent.orgSlug ?? "_";

  return (
    <Link href={`/${orgSlug}/${agent.slug}/chat`} className="block">
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm">{agent.name}</CardTitle>
              {agent.description && (
                <CardDescription className="mt-1 line-clamp-2 text-xs">
                  {agent.description}
                </CardDescription>
              )}
            </div>
          </div>
          {canEdit && (
            <CardAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={(e) => e.preventDefault()}
                  >
                    <EllipsisVerticalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      onEdit(agent);
                    }}
                  >
                    <PencilIcon className="size-4" />
                    {tc("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${orgSlug}/${agent.slug}/build`} onClick={(e) => e.stopPropagation()}>
                      <SettingsIcon className="size-4" />
                      {tn("settings")}
                    </Link>
                  </DropdownMenuItem>
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete(agent);
                      }}
                      className="text-destructive"
                    >
                      <Trash2Icon className="size-4" />
                      {tc("delete")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardAction>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}
