"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  PlusIcon,
  MinusIcon,
  PencilIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VersionListItem } from "@/lib/versions/types";
import type {
  SnapshotDiff,
  CategorySummary,
  ResourceCategoryDiff,
  SingletonDiff,
  FieldChange,
} from "@/lib/versions/diff";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface VersionDiffSheetProps {
  agentId: string;
  /** The version we're comparing FROM (the one open in detail sheet) */
  fromVersionId: string | null;
  fromVersionLabel: string;
  /** Available versions to compare TO */
  versions: VersionListItem[];
  editingVersionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionDiffSheet({
  agentId,
  fromVersionId,
  fromVersionLabel,
  versions,
  editingVersionId,
  open,
  onOpenChange,
}: VersionDiffSheetProps) {
  const [toVersionId, setToVersionId] = useState<string | null>(null);

  const apiUrl =
    fromVersionId && toVersionId
      ? `/api/agents/${agentId}/versions/diff?from=${fromVersionId}&to=${toVersionId}`
      : null;

  const { data, isLoading } = useSWR<{
    diff: SnapshotDiff;
    summary: CategorySummary[];
  }>(apiUrl, fetcher);

  // Filter out the "from" version from the picker
  const pickableVersions = versions.filter((v) => v.id !== fromVersionId);
  const hasEditingOption =
    editingVersionId && editingVersionId !== fromVersionId;

  const toLabel = toVersionId
    ? toVersionId === editingVersionId
      ? "Current (editing)"
      : `v${versions.find((v) => v.id === toVersionId)?.version ?? "?"}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-sm">
            Compare v{fromVersionLabel}
            {toLabel && (
              <>
                {" "}
                <ArrowRightIcon className="inline size-3.5" /> {toLabel}
              </>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Version comparison
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0 px-4">
          {/* Version picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Compare with
            </label>
            <Select
              value={toVersionId ?? ""}
              onValueChange={(v) => setToVersionId(v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a version..." />
              </SelectTrigger>
              <SelectContent>
                {hasEditingOption && (
                  <SelectItem value={editingVersionId!}>
                    Current (editing)
                  </SelectItem>
                )}
                {pickableVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Diff content */}
          {!toVersionId ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Select a version to compare
            </p>
          ) : isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : data ? (
            <ScrollArea className="flex-1 min-h-0">
              <DiffOverview
                summary={data.summary}
                diff={data.diff}
              />
            </ScrollArea>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────── Diff Overview ─────────── */

function DiffOverview({
  summary,
  diff,
}: {
  summary: CategorySummary[];
  diff: SnapshotDiff;
}) {
  const hasAnyChanges = summary.some((s) => s.hasChanges);

  if (!hasAnyChanges) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No differences found
      </p>
    );
  }

  return (
    <div className="space-y-1 pb-4">
      {summary.map((cat) => (
        <CategoryRow key={cat.key} summary={cat} diff={diff} />
      ))}
    </div>
  );
}

/* ─────────── Category Row (expandable) ─────────── */

function CategoryRow({
  summary,
  diff,
}: {
  summary: CategorySummary;
  diff: SnapshotDiff;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!summary.hasChanges) {
    return (
      <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/50">
        <span className="flex-1">{summary.label}</span>
        <span className="font-mono">—</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRightIcon
          className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <span className="flex-1 text-left font-medium">{summary.label}</span>
        <DiffBadges
          added={summary.added}
          removed={summary.removed}
          modified={summary.modified}
        />
      </button>

      {expanded && (
        <div className="ml-5 border-l pl-3 pb-1">
          <CategoryDetail categoryKey={summary.key} diff={diff} />
        </div>
      )}
    </div>
  );
}

/* ─────────── Diff Badges (+N ~N -N) ─────────── */

function DiffBadges({
  added,
  removed,
  modified,
}: {
  added: number;
  removed: number;
  modified: number;
}) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px]">
      {added > 0 && <span className="text-green-600">+{added}</span>}
      {modified > 0 && <span className="text-yellow-600">~{modified}</span>}
      {removed > 0 && <span className="text-red-600">-{removed}</span>}
    </div>
  );
}

/* ─────────── Category Detail (expanded view) ─────────── */

function CategoryDetail({
  categoryKey,
  diff,
}: {
  categoryKey: keyof SnapshotDiff;
  diff: SnapshotDiff;
}) {
  const cat = diff[categoryKey];

  // Singleton diff (chatConfig, memoryConfig)
  if ("status" in cat) {
    const s = cat as SingletonDiff;
    if (s.status === "added") {
      return <p className="text-xs text-green-600 py-1">Added</p>;
    }
    if (s.status === "removed") {
      return <p className="text-xs text-red-600 py-1">Removed</p>;
    }
    if (s.status === "modified") {
      return (
        <div className="space-y-1 py-1">
          {s.changes.map((c) => (
            <FieldChangeRow key={c.field} change={c} />
          ))}
        </div>
      );
    }
    return null;
  }

  // Array diff
  const d = cat as ResourceCategoryDiff;

  return (
    <div className="space-y-1 py-1">
      {d.added.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-1.5 text-xs text-green-600"
        >
          <PlusIcon className="size-3" />
          <span>{item.name}</span>
        </div>
      ))}
      {d.modified.map((item) => (
        <ModifiedItemRow key={item.key} item={item} />
      ))}
      {d.removed.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-1.5 text-xs text-red-600"
        >
          <MinusIcon className="size-3" />
          <span className="line-through">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────── Modified Item (expandable field changes) ─────────── */

function ModifiedItemRow({ item }: { item: { key: string; name: string; changes: FieldChange[] } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-xs text-yellow-600 hover:bg-accent/50 rounded px-1 py-0.5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <PencilIcon className="size-3" />
        <span className="flex-1 text-left">{item.name}</span>
        <ChevronRightIcon
          className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="ml-4 space-y-0.5 py-0.5">
          {item.changes.map((c) => (
            <FieldChangeRow key={c.field} change={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── Field Change Row ─────────── */

function FieldChangeRow({ change }: { change: FieldChange }) {
  const fromStr = formatValue(change.from);
  const toStr = formatValue(change.to);

  return (
    <div className="text-[11px] leading-relaxed">
      <span className="text-muted-foreground">{change.field}: </span>
      <span className="text-red-600/70 line-through">{fromStr}</span>
      <span className="text-muted-foreground"> → </span>
      <span className="text-green-600">{toStr}</span>
    </div>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") {
    if (val.length > 80) return `"${val.slice(0, 77)}..."`;
    return `"${val}"`;
  }
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === "object") {
    const keys = Object.keys(val as Record<string, unknown>);
    return `{${keys.length} fields}`;
  }
  return String(val);
}
