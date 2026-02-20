"use client";

import { useState, useCallback } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface KeyFieldProps {
  value: string;
}

export function KeyField({ value }: KeyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">Key</label>
      <div className="relative mt-1">
        <Input
          className="h-8 pr-8 text-sm font-mono bg-muted"
          value={value}
          readOnly
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-8 w-8"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}
