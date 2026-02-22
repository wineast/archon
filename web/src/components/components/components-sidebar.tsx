"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, GlobeIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import componentsGuide from "../../../guide/components.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { inferComponentDeps } from "@/tool-ui";
import type { ComponentRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";
import { ComponentListItem } from "./component-list-item";

interface ComponentsSidebarProps {
  components: WithPoolMeta<ComponentRow>[];
  activeComponentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onAddFromPool?: () => void;
  onRemoveRef?: (refId: string) => void;
}

export function ComponentsSidebar({
  components,
  activeComponentId,
  onSelect,
  onCreate,
  onAddFromPool,
  onRemoveRef,
}: ComponentsSidebarProps) {
  const t = useTranslations("build");
  const tc = useTranslations("common");
  const ta = useTranslations("admin");

  const privateComponents = components.filter((c) => c._source === "private");
  const poolComponents = components.filter((c) => c._source === "pool");

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
          <span className="text-sm font-semibold">{t("components")}</span>
          <GuideDialog title="组件模块" content={componentsGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title={t("newComponent")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {/* Custom group */}
          <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {tc("custom")}
          </p>
          {privateComponents.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noComponents")}
            </p>
          ) : (
            privateComponents.map((component) => (
              <ComponentListItem
                key={component.id}
                component={component}
                isActive={activeComponentId === component.id}
                onSelect={onSelect}
                usedByCount={usedByMap.get(component.key) ?? 0}
              />
            ))
          )}

          {/* Pool group */}
          {poolComponents.length > 0 && (
            <>
              <div className="mt-2 mb-1 px-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {ta("poolRefs")}
                </span>
              </div>
              {poolComponents.map((component) => (
                <div key={component.id} className="group flex items-center">
                  <button
                    type="button"
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                      activeComponentId === component.id && "bg-muted font-medium"
                    )}
                    onClick={() => onSelect(component.id)}
                  >
                    <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-left">{component.name}</span>
                    {component.origin === "builtin" && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-[10px] px-1.5 py-0"
                      >
                        {tc("builtIn")}
                      </Badge>
                    )}
                  </button>
                  {component._refId && onRemoveRef && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="mr-1 opacity-0 group-hover:opacity-100"
                      onClick={() => onRemoveRef(component._refId!)}
                      title={ta("removeRef")}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
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
