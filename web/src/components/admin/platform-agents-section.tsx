"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { AGENT_ICON_MAP } from "@/components/agents/icon-picker";
import { useAdminAgents } from "@/lib/admin/hooks";

export function PlatformAgentsSection() {
  const t = useTranslations("admin");
  const { agents, isLoading } = useAdminAgents();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        {t("platformAgents", { count: agents.length })}
      </h2>
      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noPlatformAgents")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {agents.map((agent) => {
            const Icon = AGENT_ICON_MAP[agent.icon] ?? AGENT_ICON_MAP["bot"];
            return (
              <Link
                key={agent.id}
                href={`/${agent.orgSlug}/${agent.slug}/build`}
                className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  {agent.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {agent.description}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">{agent.orgName}</Badge>
                <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
