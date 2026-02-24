"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronDownIcon,
  ClockIcon,
  Trash2Icon,
} from "lucide-react";
import type { ToolTestRunRow } from "@/db/schema";
import type { ToolTestRunDetail } from "@/lib/tools/test-case-hooks";
import { ToolRunResultCard } from "./tool-run-result-card";
import type { ToolComponentPreviewData } from "./tool-component-preview";

interface ToolRunHistoryItemProps {
  run: ToolTestRunRow;
  expanded: boolean;
  detail?: ToolTestRunDetail;
  loadingDetail: boolean;
  deletingRun: boolean;
  onToggle: () => void;
  onDelete: () => void;
  toolName?: string;
  componentPreview?: ToolComponentPreviewData | null;
}

export function ToolRunHistoryItem({
  run,
  expanded,
  detail,
  loadingDetail,
  deletingRun,
  onToggle,
  onDelete,
  toolName,
  componentPreview,
}: ToolRunHistoryItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
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
            setConfirmOpen(true);
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
                <ToolRunResultCard key={r.id} result={r} toolName={toolName} componentPreview={componentPreview} />
              ))}
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Run"
        description="Are you sure you want to delete this test run? This action cannot be undone."
        onConfirm={async () => {
          onDelete();
        }}
      />
    </div>
  );
}
