"use client";

import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { inferComponentDeps } from "@/tool-ui";
import type { ComponentRow } from "@/db/schema";
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
        <span className="text-sm font-semibold">Components</span>
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
