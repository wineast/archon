"use client";

import { type ReactNode, useState } from "react";
import { HelpCircleIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GuideDialogProps {
  title: string;
  content: string;
  trigger?: ReactNode;
}

export function GuideDialog({ title, content, trigger }: GuideDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setOpen(true)}
        >
          <HelpCircleIcon className="size-3.5" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-w-3xl flex-col gap-0 p-0 h-[80vh]">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
            <div className="prose prose-sm dark:prose-invert max-w-none p-6 overflow-hidden prose-pre:overflow-x-auto prose-table:overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
