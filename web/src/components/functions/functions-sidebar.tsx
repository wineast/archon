"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, GlobeIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuideDialog } from "@/components/ui/guide-dialog";
import functionsGuide from "../../../guide/functions.md";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FunctionRow } from "@/db/schema";
import type { WithPoolMeta } from "@/lib/pool/queries";

interface FunctionsSidebarProps {
  functions: WithPoolMeta<FunctionRow>[];
  activeFunctionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onAddFromPool?: () => void;
  onRemoveRef?: (refId: string) => void;
}

function FunctionListItem({
  fn,
  isActive,
  onSelect,
}: {
  fn: FunctionRow;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const handleSelect = useCallback(() => {
    onSelect(fn.id);
  }, [fn.id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isActive && "bg-muted font-medium"
      )}
      onClick={handleSelect}
    >
      <span className="min-w-0 flex-1 truncate">{fn.name}</span>
      <Badge variant="secondary" className="shrink-0 text-[10px] font-mono">
        {fn.key}
      </Badge>
    </button>
  );
}

export function FunctionsSidebar({
  functions,
  activeFunctionId,
  onSelect,
  onCreate,
  onAddFromPool,
  onRemoveRef,
}: FunctionsSidebarProps) {
  const t = useTranslations("build");
  const ta = useTranslations("admin");
  const tc = useTranslations("common");

  const privateFunctions = functions.filter((f) => f._source === "private");
  const poolFunctions = functions.filter((f) => f._source === "pool");

  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold">{t("functions")}</span>
          <GuideDialog title="函数模块" content={functionsGuide} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title={t("newFunction")}
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {privateFunctions.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("noFunctions")}
            </p>
          ) : (
            privateFunctions.map((fn) => (
              <FunctionListItem
                key={fn.id}
                fn={fn}
                isActive={activeFunctionId === fn.id}
                onSelect={onSelect}
              />
            ))
          )}

          {poolFunctions.length > 0 && (
            <>
              <div className="mt-2 mb-1 px-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {ta("poolRefs")}
                </span>
              </div>
              {poolFunctions.map((fn) => (
                <div key={fn.id} className="group flex items-center">
                  <button
                    type="button"
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                      activeFunctionId === fn.id && "bg-muted font-medium"
                    )}
                    onClick={() => onSelect(fn.id)}
                  >
                    <GlobeIcon className="size-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-left">{fn.name}</span>
                    {fn.origin === "builtin" && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {tc("builtIn")}
                      </Badge>
                    )}
                  </button>
                  {fn._refId && onRemoveRef && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="mr-1 opacity-0 group-hover:opacity-100"
                      onClick={() => onRemoveRef(fn._refId!)}
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
