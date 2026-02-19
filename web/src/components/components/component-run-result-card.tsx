"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ComponentTestRunResultRow } from "@/db/schema";

interface ComponentRunResultCardProps {
  result: ComponentTestRunResultRow;
  defaultOpen?: boolean;
}

export function ComponentRunResultCard({
  result,
  defaultOpen = false,
}: ComponentRunResultCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border">
      {/* Collapsible header */}
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent/50"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <ChevronDownIcon
          className={`size-3 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="flex-1 truncate font-medium">{result.caseName}</span>
        {result.error ? (
          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
            Error
          </Badge>
        ) : result.passed ? (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 px-1.5 py-0 text-[10px]"
          >
            Passed
          </Badge>
        ) : (
          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
            Failed
          </Badge>
        )}
        <span className="shrink-0 text-muted-foreground">
          {result.durationMs}ms
        </span>
      </div>

      {/* Collapsible content */}
      {open && (
        <div className="space-y-2 border-t px-3 py-2">
          {result.error && (
            <div className="rounded bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap">
              {result.error}
            </div>
          )}

          <div>
            <p className="text-[10px] font-medium text-muted-foreground">
              Tool
            </p>
            <pre className="mt-0.5 text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(result.tool, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
