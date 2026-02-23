"use client";

import { useState, useCallback } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface KeyDisplayProps {
  value: string;
}

export function KeyDisplay({ value }: KeyDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">Key</label>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-sm font-mono">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckIcon className="h-3 w-3 text-green-600" />
          ) : (
            <CopyIcon className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}
