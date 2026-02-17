"use client";

import { useCallback, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeEditor } from "@/components/ui/code-editor";

export interface EntryDraft {
  value: string;
  label: string;
  metadata: Record<string, unknown> | null;
}

interface LookupEntryRowProps {
  entry: EntryDraft;
  onChange: (updated: EntryDraft) => void;
  onDelete: () => void;
}

export function LookupEntryRow({
  entry,
  onChange,
  onDelete,
}: LookupEntryRowProps) {
  const [expanded, setExpanded] = useState(false);

  const handleMetadataChange = useCallback(
    (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        onChange({ ...entry, metadata: parsed });
      } catch {
        // ignore invalid JSON while typing
      }
    },
    [entry, onChange]
  );

  return (
    <div className="rounded-md border p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </Button>
        <Input
          className="h-7 w-[140px] text-xs"
          value={entry.value}
          onChange={(e) => onChange({ ...entry, value: e.target.value })}
          placeholder="value"
        />
        <Input
          className="h-7 flex-1 text-xs"
          value={entry.label}
          onChange={(e) => onChange({ ...entry, label: e.target.value })}
          placeholder="label"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="size-7 p-0"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
      {expanded && (
        <div className="pl-8">
          <label className="text-[10px] font-medium text-muted-foreground">
            Metadata (JSON)
          </label>
          <CodeEditor
            value={JSON.stringify(entry.metadata ?? {}, null, 2)}
            onChange={handleMetadataChange}
            language="json"
            height="120px"
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}
