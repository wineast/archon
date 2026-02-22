"use client";

import { useTranslations } from "next-intl";
import { PlusIcon, GlobeIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import toolsGuide from "../../../guide/tools.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ToolRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";
import { ToolListItem } from "./tool-list-item";

interface ToolsSidebarProps {
  tools: WithPoolMeta<ToolRow>[];
  activeToolId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  hasEnabledSkills?: boolean;
  onSelectBuiltin?: (key: string) => void;
  activeBuiltinToolKey?: string | null;
  onAddFromPool?: () => void;
  onRemoveRef?: (refId: string) => void;
}

export function ToolsSidebar({
  tools,
  activeToolId,
  onSelect,
  onCreate,
  hasEnabledSkills,
  onSelectBuiltin,
  activeBuiltinToolKey,
  onAddFromPool,
  onRemoveRef,
}: ToolsSidebarProps) {
  const t = useTranslations("build");
  const ta = useTranslations("admin");
  const tc = useTranslations("common");

  const privateTools = tools.filter((t) => t._source === "private");
  const poolTools = tools.filter((t) => t._source === "pool");

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("tools")}</span>
          <GuideDialog title="工具模块" content={toolsGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title={t("newTool")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {privateTools.length === 0 && poolTools.length === 0 && !hasEnabledSkills ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noTools")}
            </p>
          ) : (
            <>
              {hasEnabledSkills && (
                <>
                  <div className="mb-1 px-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {tc("builtIn")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                      activeBuiltinToolKey === "get_skill_detail"
                        ? "bg-muted font-medium"
                        : ""
                    }`}
                    onClick={() => onSelectBuiltin?.("get_skill_detail")}
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="min-w-0 flex-1 truncate text-left">get_skill_detail</span>
                  </button>
                </>
              )}

              {privateTools.length > 0 && (
                <>
                  {hasEnabledSkills && (
                    <div className="mt-2 mb-1 px-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {tc("custom")}
                      </span>
                    </div>
                  )}
                  {privateTools.map((tool) => (
                    <ToolListItem
                      key={tool.id}
                      tool={tool}
                      isActive={activeToolId === tool.id}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              )}

              {poolTools.length > 0 && (
                <>
                  <div className="mt-2 mb-1 px-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ta("poolRefs")}
                    </span>
                  </div>
                  {poolTools.map((tool) => (
                    <div key={tool.id} className="group flex items-center">
                      <button
                        type="button"
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                          activeToolId === tool.id ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => onSelect(tool.id)}
                      >
                        <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-left">{tool.name}</span>
                      </button>
                      {tool._refId && onRemoveRef && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="mr-1 opacity-0 group-hover:opacity-100"
                          onClick={() => onRemoveRef(tool._refId!)}
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
