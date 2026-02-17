"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LookupEntryRow, type EntryDraft } from "./lookup-entry-row";
import type { LookupEntryRow as LookupEntryRowType } from "@/db/schema";

export interface LookupTableFormHandle {
  getDraft: () => {
    name: string;
    description: string;
    entries: EntryDraft[];
  };
  isDirty: () => boolean;
  reset: () => void;
}

interface LookupTableFormProps {
  tableKey: string;
  name: string;
  description: string;
  entries: LookupEntryRowType[];
  onDraftRef: (ref: LookupTableFormHandle) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function toEntryDrafts(entries: LookupEntryRowType[]): EntryDraft[] {
  return entries.map((e) => ({
    value: e.value,
    label: e.label ?? "",
    metadata: (e.metadata as Record<string, unknown>) ?? null,
  }));
}

export function LookupTableForm({
  tableKey,
  name: initialName,
  description: initialDescription,
  entries: initialEntries,
  onDraftRef,
  onDirtyChange,
}: LookupTableFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [entries, setEntries] = useState<EntryDraft[]>(() =>
    toEntryDrafts(initialEntries)
  );

  const originalRef = useRef(
    JSON.stringify({ name: initialName, description: initialDescription, entries: toEntryDrafts(initialEntries) })
  );

  const nameRef = useRef(name);
  nameRef.current = name;
  const descRef = useRef(description);
  descRef.current = description;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    onDraftRef({
      getDraft: () => ({
        name: nameRef.current,
        description: descRef.current,
        entries: entriesRef.current,
      }),
      isDirty: () =>
        JSON.stringify({
          name: nameRef.current,
          description: descRef.current,
          entries: entriesRef.current,
        }) !== originalRef.current,
      reset: () => {
        const original = JSON.parse(originalRef.current);
        setName(original.name);
        setDescription(original.description);
        setEntries(original.entries);
      },
    });
  }, [onDraftRef]);

  useEffect(() => {
    const current = JSON.stringify({ name, description, entries });
    onDirtyChange?.(current !== originalRef.current);
  }, [name, description, entries, onDirtyChange]);

  const handleEntryChange = useCallback((idx: number, updated: EntryDraft) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? updated : e)));
  }, []);

  const handleEntryDelete = useCallback((idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleAddEntry = useCallback(() => {
    setEntries((prev) => [
      ...prev,
      { value: "", label: "", metadata: null },
    ]);
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Key</label>
        <Input
          className="mt-1 h-8 text-sm font-mono bg-muted"
          value={tableKey}
          readOnly
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Name
        </label>
        <Input
          className="mt-1 h-8 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Textarea
          className="mt-1 min-h-[60px] resize-none text-sm"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this lookup table contains..."
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Entries ({entries.length})
          </label>
          <Button variant="ghost" size="sm" onClick={handleAddEntry}>
            <PlusIcon className="mr-1 size-3" />
            Add
          </Button>
        </div>
        <div className="mt-1 space-y-2">
          {entries.map((entry, idx) => (
            <LookupEntryRow
              key={idx}
              entry={entry}
              onChange={(updated) => handleEntryChange(idx, updated)}
              onDelete={() => handleEntryDelete(idx)}
            />
          ))}
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No entries. Click &quot;Add&quot; to create one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
