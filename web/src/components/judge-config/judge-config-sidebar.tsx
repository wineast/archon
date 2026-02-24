"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { JudgeConfigRow } from "@/db/schema";
import { JudgeConfigListItem } from "./judge-config-list-item";

interface JudgeConfigSidebarProps {
  configs: JudgeConfigRow[];
  activeConfigId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function JudgeConfigSidebar({
  configs,
  activeConfigId,
  onSelect,
  onCreate,
}: JudgeConfigSidebarProps) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Judge Configs</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Judge Config"
          data-testid="btn-new-judge-config"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {configs.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No judge configs
            </p>
          ) : (
            configs.map((config) => (
              <JudgeConfigListItem
                key={config.id}
                config={config}
                isSelected={activeConfigId === config.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
