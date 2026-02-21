"use client";

import { useCallback, useState } from "react";
import {
  BookOpenIcon,
  BracesIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  FunctionSquareIcon,
  NetworkIcon,
  PuzzleIcon,
  RotateCcwIcon,
  SettingsIcon,
  Trash2Icon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useTrash,
  restoreResources,
  permanentDeleteResources,
  clearTrash,
  type ResourceType,
  type TrashedItem,
} from "@/lib/trash/hooks";

const TYPE_CONFIG: Record<ResourceType, { icon: LucideIcon; label: string }> = {
  tool: { icon: WrenchIcon, label: "工具" },
  function: { icon: FunctionSquareIcon, label: "函数" },
  component: { icon: PuzzleIcon, label: "组件" },
  schema: { icon: BracesIcon, label: "参数定义" },
  dataset: { icon: DatabaseIcon, label: "数据集" },
  wikiDocument: { icon: BookOpenIcon, label: "Wiki" },
  modelConfig: { icon: SettingsIcon, label: "模型配置" },
  evalCase: { icon: FlaskConicalIcon, label: "评测用例" },
  evalJudgeConfig: { icon: FlaskConicalIcon, label: "评测裁判" },
  objectType: { icon: NetworkIcon, label: "对象类型" },
  objectRelation: { icon: NetworkIcon, label: "对象关系" },
  skill: { icon: ZapIcon, label: "技能" },
};

const RESOURCE_TYPES = Object.keys(TYPE_CONFIG) as ResourceType[];

interface TrashSheetProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrashSheet({ agentId, open, onOpenChange }: TrashSheetProps) {
  const { data, isLoading, totalCount, mutate: trashMutate } = useTrash(agentId);
  const { mutate: globalMutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: ResourceType;
    item: TrashedItem;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleRestore = useCallback(
    async (type: ResourceType, item: TrashedItem) => {
      setBusy(true);
      await restoreResources(agentId, type, [item.id], trashMutate, globalMutate);
      setBusy(false);
    },
    [agentId, trashMutate, globalMutate]
  );

  const handlePermanentDelete = useCallback(async () => {
    if (!confirmDelete) return;
    await permanentDeleteResources(
      agentId,
      confirmDelete.type,
      [confirmDelete.item.id],
      trashMutate
    );
    setConfirmDelete(null);
  }, [agentId, confirmDelete, trashMutate]);

  const handleClearTrash = useCallback(async () => {
    await clearTrash(agentId, trashMutate);
    setConfirmClear(false);
  }, [agentId, trashMutate]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton
          className="flex h-full w-[95vw] flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 px-4 pt-4 pb-3">
            <SheetTitle>回收站</SheetTitle>
            <SheetDescription>已删除的资源，可恢复或永久删除</SheetDescription>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4 [&_[data-slot=scroll-area-viewport]>div]:!block">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5" />
              </div>
            ) : totalCount === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                回收站为空
              </p>
            ) : (
              <div className="space-y-4 pb-4">
                {RESOURCE_TYPES.map((type) => {
                  const items = (data?.[type] as TrashedItem[] | undefined) ?? [];
                  if (items.length === 0) return null;
                  const config = TYPE_CONFIG[type];
                  const Icon = config.icon;
                  return (
                    <div key={type}>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                        <Icon className="size-3.5" />
                        {config.label}
                        <span className="text-muted-foreground/60">({items.length})</span>
                      </div>
                      <div className="space-y-1">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-md border p-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {item.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.key} · {new Date(item.deletedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                disabled={busy}
                                onClick={() => handleRestore(type, item)}
                                title="恢复"
                              >
                                {busy ? (
                                  <Spinner className="size-3.5" />
                                ) : (
                                  <RotateCcwIcon className="size-3.5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive"
                                disabled={busy}
                                onClick={() =>
                                  setConfirmDelete({ type, item })
                                }
                                title="永久删除"
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {totalCount > 0 && (
            <div className="shrink-0 px-4 py-3">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => setConfirmClear(true)}
              >
                清空回收站
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm permanent delete single item */}
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmDelete(null);
        }}
        title="永久删除"
        description={`确定永久删除 ${confirmDelete?.item.name}？此操作不可撤销。`}
        cancelLabel="取消"
        confirmLabel="永久删除"
        onConfirm={handlePermanentDelete}
      />

      {/* Confirm clear all */}
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={(v) => {
          if (!v) setConfirmClear(false);
        }}
        title="清空回收站"
        description={`确定永久删除回收站中的所有 ${totalCount} 项资源？此操作不可撤销。`}
        cancelLabel="取消"
        confirmLabel="清空回收站"
        onConfirm={handleClearTrash}
      />
    </>
  );
}
