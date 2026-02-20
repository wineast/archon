"use client";

import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import componentsGuide from "../../../guide/components.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { inferComponentDeps } from "@/tool-ui";
import type { ComponentRow } from "@/db/schema";
import { BUILTIN_COMPONENTS } from "./builtin-components";
import { ComponentListItem } from "./component-list-item";

interface ComponentsSidebarProps {
  components: ComponentRow[];
  activeComponentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ComponentsSidebar({
  components,
  activeComponentId,
  onSelect,
  onCreate,
}: ComponentsSidebarProps) {
  // Compute how many other components reference each component
  const usedByMap = useMemo(() => {
    const knownKeys = new Set(components.map((c) => c.key));
    const counts = new Map<string, number>();
    for (const c of components) {
      const deps = inferComponentDeps(c.componentSource, knownKeys);
      for (const dep of deps) {
        counts.set(dep, (counts.get(dep) ?? 0) + 1);
      }
    }
    return counts;
  }, [components]);
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">Components</span>
          <GuideDialog title="组件模块" content={componentsGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Component"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {/* Built-in group */}
          <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Built-in
          </p>
          {BUILTIN_COMPONENTS.map((def) => {
            const id = `builtin:${def.key}`;
            return (
              <button
                key={id}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
                  activeComponentId === id && "bg-muted font-medium"
                )}
                onClick={() => onSelect(id)}
              >
                <span className="min-w-0 flex-1 truncate">{def.name}</span>
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] px-1.5 py-0"
                >
                  Built-in
                </Badge>
              </button>
            );
          })}

          {/* Custom group */}
          <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Custom
          </p>
          {components.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No components yet
            </p>
          ) : (
            components.map((component) => (
              <ComponentListItem
                key={component.id}
                component={component}
                isActive={activeComponentId === component.id}
                onSelect={onSelect}
                usedByCount={usedByMap.get(component.key) ?? 0}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
