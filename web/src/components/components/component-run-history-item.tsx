"use client";

import { Spinner } from "@/components/ui/spinner";
import {
  ChevronDownIcon,
  ClockIcon,
  Trash2Icon,
} from "lucide-react";
import type { ComponentTestRunRow } from "@/db/schema";
import type { ComponentTestRunDetail } from "@/lib/components/test-case-hooks";
import { ComponentRunResultCard } from "./component-run-result-card";

interface ComponentRunHistoryItemProps {
  run: ComponentTestRunRow;
  expanded: boolean;
  detail?: ComponentTestRunDetail;
  loadingDetail: boolean;
  deletingRun: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

export function ComponentRunHistoryItem({
  run,
  expanded,
  detail,
  loadingDetail,
  deletingRun,
  onToggle,
  onDelete,
}: ComponentRunHistoryItemProps) {
  const passRate =
    run.totalCases > 0
      ? `${run.passedCases}/${run.totalCases}`
      : "0/0";

  return (
    <div className="rounded-md border">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent cursor-pointer"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <ChevronDownIcon
          className={`size-3 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
        />
        <ClockIcon className="size-3 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">
          {new Date(run.createdAt).toLocaleString()}
        </span>
        <span className="shrink-0 font-medium">{passRate}</span>
        {run.filterTags.length > 0 && (
          <span className="shrink-0 text-muted-foreground truncate max-w-[100px]">
            {run.filterTags.join(", ")}
          </span>
        )}
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted-foreground/20 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deletingRun}
        >
          {deletingRun ? (
            <Spinner className="size-3" />
          ) : (
            <Trash2Icon className="size-3" />
          )}
        </button>
      </div>
      {expanded && (
        <div className="space-y-1 border-t px-3 py-2">
          {loadingDetail && (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              Loading details...
            </div>
          )}
          {detail && (
            <>
              {detail.results.map((r) => (
                <ComponentRunResultCard key={r.id} result={r} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
