"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SchemaTestRunResultRow } from "@/db/schema";

interface SchemaRunResultCardProps {
  result: SchemaTestRunResultRow;
  defaultOpen?: boolean;
}

export function SchemaRunResultCard({
  result,
  defaultOpen = false,
}: SchemaRunResultCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const errorCount = result.actualErrors?.length ?? 0;

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
        {result.passed ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800 px-1.5 py-0 text-[10px]">
            Passed
          </Badge>
        ) : (
          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">Failed</Badge>
        )}
        <span className="shrink-0 text-muted-foreground">
          {result.durationMs}ms
        </span>
      </div>

      {/* Collapsible content */}
      {open && (
        <div className="space-y-2 border-t px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Expected:</span>
            <span>{result.shouldPass ? "Valid" : "Invalid"}</span>
            <span className="text-muted-foreground">Actual:</span>
            <span>{result.actualValid ? "Valid" : "Invalid"}</span>
          </div>

          <div>
            <p className="text-[10px] font-medium text-muted-foreground">Input</p>
            <pre className="mt-0.5 text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(result.input, null, 2)}
            </pre>
          </div>

          {result.actualErrors && result.actualErrors.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">
                Validation Errors ({errorCount})
              </p>
              <div className="mt-0.5 space-y-1">
                {result.actualErrors.map((err, i) => (
                  <div key={i} className="rounded bg-destructive/10 px-2 py-1 text-xs">
                    <span className="font-mono text-destructive">{err.path || "(root)"}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.expectedErrors && result.expectedErrors.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">Expected Errors</p>
              <div className="mt-0.5 space-y-1">
                {result.expectedErrors.map((err, i) => (
                  <div key={i} className="rounded bg-muted px-2 py-1 text-xs">
                    <span className="font-mono">{err.path || "(root)"}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
