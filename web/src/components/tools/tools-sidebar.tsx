"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import toolsGuide from "../../../guide/tools.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ToolRow } from "@/db/schema";
import { ToolListItem } from "./tool-list-item";

interface ToolsSidebarProps {
  tools: ToolRow[];
  activeToolId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ToolsSidebar({
  tools,
  activeToolId,
  onSelect,
  onCreate,
}: ToolsSidebarProps) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">Tools</span>
          <GuideDialog title="工具模块" content={toolsGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Tool"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {tools.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No tools yet
            </p>
          ) : (
            tools.map((tool) => (
              <ToolListItem
                key={tool.id}
                tool={tool}
                isActive={activeToolId === tool.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
