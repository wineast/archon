"use client";

import { useState } from "react";
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
import helpDoc from "../../../guide/component-authoring.md";

export function ComponentHelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => setOpen(true)}
      >
        <HelpCircleIcon className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-w-3xl flex-col gap-0 p-0 h-[80vh]">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>组件编写指南</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="prose prose-sm dark:prose-invert max-w-none p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {helpDoc}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
