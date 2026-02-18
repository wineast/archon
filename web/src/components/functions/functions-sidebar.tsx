"use client";

import { useCallback } from "react";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FunctionRow } from "@/db/schema";
import type { BuiltinFunction } from "@/lib/functions/builtin";

interface FunctionsSidebarProps {
  builtinFunctions: BuiltinFunction[];
  functions: FunctionRow[];
  activeFunctionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

function BuiltinListItem({
  fn,
  isActive,
  onSelect,
}: {
  fn: BuiltinFunction;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  const id = `builtin:${fn.key}`;
  const handleSelect = useCallback(() => {
    onSelect(id);
  }, [id, onSelect]);

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left",
        isActive && "bg-muted font-medium"
      )}
      onClick={handleSelect}
    >
      <span className="min-w-0 flex-1 truncate">{fn.name}</span>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        Built-in
      </Badge>
    </button>
  );
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
  builtinFunctions,
  functions,
  activeFunctionId,
  onSelect,
  onCreate,
}: FunctionsSidebarProps) {
  return (
    <div className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Functions</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          title="New Function"
        >
          <PlusIcon className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="p-1">
          {builtinFunctions.map((fn) => (
            <BuiltinListItem
              key={fn.key}
              fn={fn}
              isActive={activeFunctionId === `builtin:${fn.key}`}
              onSelect={onSelect}
            />
          ))}
          {functions.length === 0 && builtinFunctions.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No functions yet
            </p>
          ) : (
            functions.map((fn) => (
              <FunctionListItem
                key={fn.id}
                fn={fn}
                isActive={activeFunctionId === fn.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
