"use client";

import { useCallback, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  token: string;
}

export function EmbedCodeDialog({
  open,
  onOpenChange,
  agentId,
  token,
}: EmbedCodeDialogProps) {
  const [copied, setCopied] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  const embedCode = `<script
  src="${origin}/embed/widget.js"
  data-agent-id="${agentId}"
  data-token="${token}"
></script>`;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [embedCode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed Code</DialogTitle>
          <DialogDescription>
            Copy the code below and paste it into your website&apos;s HTML.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">
            <code>{embedCode}</code>
          </pre>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-7"
            onClick={handleCopy}
          >
            {copied ? (
              <CheckIcon className="size-3.5" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </Button>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>Optional attributes:</p>
          <ul className="list-inside list-disc space-y-1">
            <li><code>data-position</code> — bottom-right (default), bottom-left, top-right, top-left</li>
            <li><code>data-button-color</code> — CSS color for the chat button</li>
            <li><code>data-width</code> / <code>data-height</code> — Chat window size in px</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
