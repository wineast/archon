"use client";

import { LibraryIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LibEntry } from "./libs-panel";

interface LibsSidebarProps {
  libs: LibEntry[];
  activeKey: string | null;
  onSelect: (key: string) => void;
}

export function LibsSidebar({ libs, activeKey, onSelect }: LibsSidebarProps) {
  return (
    <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r">
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Libs</span>
      </div>

      {/* List */}
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="flex flex-col gap-0.5 p-1">
          {libs.map((lib) => (
            <button
              key={lib.key}
              type="button"
              onClick={() => onSelect(lib.key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                "hover:bg-accent",
                activeKey === lib.key && "bg-muted font-medium"
              )}
            >
              <LibraryIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{lib.name}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
