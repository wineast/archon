"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  Trash2Icon,
  PlusIcon,
} from "lucide-react";
import type { SchemaWithIncludes } from "@/db/schema";
import { getReachableSchemaIds } from "@/lib/schemas/resolve";

interface SchemaIncludesEditorProps {
  includeSchemaIds: string[];
  onChange: (ids: string[]) => void;
  allSchemas: SchemaWithIncludes[];
  currentSchemaId?: string;
}

export function SchemaIncludesEditor({
  includeSchemaIds,
  onChange,
  allSchemas,
  currentSchemaId,
}: SchemaIncludesEditorProps) {
  const allSchemasMap = useMemo(
    () => new Map(allSchemas.map((s) => [s.id, s])),
    [allSchemas]
  );

  // Filter schemas that can be added (exclude self, already included, and those that would create cycles)
  const availableSchemas = useMemo(() => {
    if (!currentSchemaId) return allSchemas;

    const reachable = getReachableSchemaIds(currentSchemaId, allSchemasMap);
    const alreadyIncluded = new Set(includeSchemaIds);

    return allSchemas.filter((s) => {
      if (s.id === currentSchemaId) return false;
      if (alreadyIncluded.has(s.id)) return false;
      // Check if adding this schema would create a cycle:
      // s's reachable set includes currentSchemaId → cycle
      const sReachable = getReachableSchemaIds(s.id, allSchemasMap);
      if (sReachable.has(currentSchemaId)) return false;
      return true;
    });
  }, [allSchemas, allSchemasMap, currentSchemaId, includeSchemaIds]);

  const handleAdd = (schemaId: string) => {
    if (!schemaId) return;
    onChange([...includeSchemaIds, schemaId]);
  };

  const handleRemove = (index: number) => {
    onChange(includeSchemaIds.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...includeSchemaIds];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index === includeSchemaIds.length - 1) return;
    const next = [...includeSchemaIds];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        Includes
      </label>
      <div className="mt-1 space-y-1">
        {includeSchemaIds.map((id, index) => {
          const schema = allSchemasMap.get(id);
          return (
            <div
              key={id}
              className="flex items-center gap-1 rounded border px-2 py-1 text-sm"
            >
              <span className="flex-1 truncate">
                {schema?.name ?? id}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="size-6 p-0"
              >
                <ArrowUpIcon className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMoveDown(index)}
                disabled={index === includeSchemaIds.length - 1}
                className="size-6 p-0"
              >
                <ArrowDownIcon className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                className="size-6 p-0"
              >
                <Trash2Icon className="size-3" />
              </Button>
            </div>
          );
        })}

        {availableSchemas.length > 0 && (
          <Select onValueChange={handleAdd} value="">
            <SelectTrigger size="sm" className="w-full">
              <div className="flex items-center gap-1">
                <PlusIcon className="size-3" />
                <SelectValue placeholder="添加 Schema..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableSchemas.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {includeSchemaIds.length === 0 && availableSchemas.length === 0 && (
          <p className="text-xs text-muted-foreground">无可用的 Schema</p>
        )}
      </div>
    </div>
  );
}
