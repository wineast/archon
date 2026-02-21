"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { McpServerRow } from "@/db/schema";
import { cn } from "@/lib/utils";

interface McpServersSidebarProps {
  mcpServers: McpServerRow[];
  activeId: string | null;
  mcpEnabled: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onToggleMcp: (enabled: boolean) => void;
}

export function McpServersSidebar({
  mcpServers,
  activeId,
  mcpEnabled,
  onSelect,
  onCreate,
  onToggleMcp,
}: McpServersSidebarProps) {
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
            title="New MCP Server"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {mcpServers.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No MCP servers yet
            </p>
          ) : (
            mcpServers.map((server) => (
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
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
