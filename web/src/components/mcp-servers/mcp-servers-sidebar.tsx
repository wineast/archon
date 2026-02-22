"use client";

import { useTranslations } from "next-intl";
import { PlusIcon, GlobeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { McpServerRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";
import { cn } from "@/lib/utils";

interface McpServersSidebarProps {
  mcpServers: WithPoolMeta<McpServerRow>[];
  activeId: string | null;
  mcpEnabled: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onToggleMcp: (enabled: boolean) => void;
  onAddFromPool?: () => void;
  onRemoveRef?: (refId: string) => void;
}

export function McpServersSidebar({
  mcpServers,
  activeId,
  mcpEnabled,
  onSelect,
  onCreate,
  onToggleMcp,
  onAddFromPool,
  onRemoveRef,
}: McpServersSidebarProps) {
  const t = useTranslations("build");
  const ta = useTranslations("admin");

  const privateServers = mcpServers.filter((s) => s._source === "private");
  const poolServers = mcpServers.filter((s) => s._source === "pool");

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">MCP Servers</span>
        <div className="flex items-center gap-1">
          <Switch
            checked={mcpEnabled}
            onCheckedChange={onToggleMcp}
            className="scale-75"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCreate}
            title={t("newMcpServer")}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {privateServers.length === 0 && poolServers.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noMcpServers")}
            </p>
          ) : (
            <>
              {privateServers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => onSelect(server.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    activeId === server.id && "bg-accent font-medium"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      server.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                    )}
                  />
                  <span className="truncate">{server.name}</span>
                </button>
              ))}

              {poolServers.length > 0 && (
                <>
                  <div className="mt-2 mb-1 px-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ta("poolRefs")}
                    </span>
                  </div>
                  {poolServers.map((server) => (
                    <div key={server.id} className="group flex items-center">
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                          activeId === server.id && "bg-muted font-medium"
                        )}
                        onClick={() => onSelect(server.id)}
                      >
                        <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-left">{server.name}</span>
                      </button>
                      {server._refId && onRemoveRef && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="mr-1 opacity-0 group-hover:opacity-100"
                          onClick={() => onRemoveRef(server._refId!)}
                          title={ta("removeRef")}
                        >
                          <XIcon className="size-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      {onAddFromPool && (
        <div className="border-t px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onAddFromPool}
          >
            <GlobeIcon className="mr-1 size-3" />
            {ta("addFromPool")}
          </Button>
        </div>
      )}
    </div>
  );
}
