"use client";

import { useState, useCallback } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LibEntry } from "./libs-panel";

interface LibDetailProps {
  lib: LibEntry;
}

export function LibDetail({ lib }: LibDetailProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(lib.importExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [lib.importExample]);

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-6 p-6">
        {/* Title */}
        <div>
          <h2 className="text-lg font-semibold">{lib.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lib.description}</p>
        </div>

        {/* Import example */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Import</label>
          <div className="mt-1 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
            <code className="flex-1 select-all">{lib.importExample}</code>
            <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={handleCopy}>
              {copied ? (
                <CheckIcon className="size-3.5 text-green-600" />
              ) : (
                <CopyIcon className="size-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Signature */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Signature</label>
          <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
            {lib.signature}
          </div>
        </div>

        {/* Parameters */}
        {lib.parameters.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Parameters</label>
            <div className="mt-1 flex flex-col gap-2">
              {lib.parameters.map((param) => (
                <div key={param.name} className="rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{param.name}</span>
                    <Badge variant="secondary" className="text-xs">{param.type}</Badge>
                  </div>
                  {param.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{param.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Returns */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Returns</label>
          <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
            {lib.returns}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
