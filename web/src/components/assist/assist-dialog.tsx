"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { JsEditor } from "@/components/editors/js-editor";
import { MdEditor } from "@/components/editors/md-editor";
import { JsonEditor } from "@/components/editors/json-editor";
import { useAgentSlots } from "@/lib/slots/hooks";

export interface AssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onApply: (content: string) => void;
  agentId?: string;
  editorType: "js" | "md" | "json";
  title: string;
  fieldContext: string;
  placeholder?: string;
  emptyHint?: string;
}

const EditorMap = {
  js: JsEditor,
  md: MdEditor,
  json: JsonEditor,
} as const;

export function AssistDialog({
  open,
  onOpenChange,
  content,
  onApply,
  agentId,
  editorType,
  title,
  fieldContext,
  placeholder = "描述你想要的修改...",
  emptyHint = "描述你想要的修改，AI 会帮你更新左侧内容",
}: AssistDialogProps) {
  const [draftContent, setDraftContent] = useState(content);
  const [originalContent, setOriginalContent] = useState(content);
  const [isStreaming, setIsStreaming] = useState(false);
  const draftContentRef = useRef(draftContent);
  draftContentRef.current = draftContent;

  const hasDiff = draftContent !== originalContent;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Resolve assist agent ID from slots
  const { slots } = useAgentSlots(agentId);
  const assistAgentId = useMemo(() => {
    const assistSlot = slots.find((s) => s.slotKey === "assist");
    return assistSlot?.agentId ?? null;
  }, [slots]);

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraftContent(content);
        setOriginalContent(content);
        draftContentRef.current = content;
        setIsStreaming(false);
      }
      onOpenChange(nextOpen);
    },
    [content, onOpenChange]
  );

  // Sync content with external changes on open
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraftContent(content);
      setOriginalContent(content);
      draftContentRef.current = content;
      setIsStreaming(false);
    }
    prevOpenRef.current = open;
  }, [open, content]);

  // Send initial context after iframe ready
  const sendContext = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        type: "archon:context",
        payload: {
          fieldContext,
          currentContent: draftContentRef.current,
        },
      },
      "*"
    );
  }, [fieldContext]);

  const sendToolsRegister = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        type: "archon:tools-register",
        payload: ["update_content", "edit_content"],
      },
      "*"
    );
  }, []);

  // Debounced context update when draft changes
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!open) return;
    debounceTimerRef.current = setTimeout(() => {
      sendContext();
    }, 500);
    return () => clearTimeout(debounceTimerRef.current);
  }, [draftContent, open, sendContext]);

  // postMessage listener
  useEffect(() => {
    if (!open) return;

    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data.type !== "string") return;

      switch (data.type) {
        case "archon:ready":
          sendContext();
          sendToolsRegister();
          break;

        case "archon:tool-call": {
          const { callId, toolName, args } = data.payload ?? {};
          let result: string;

          if (toolName === "update_content") {
            const newContent = args?.content ?? "";
            setDraftContent(newContent);
            draftContentRef.current = newContent;
            result = "已更新";
          } else if (toolName === "edit_content") {
            const { old_text, new_text } = args ?? {};
            const current = draftContentRef.current;
            if (current.includes(old_text)) {
              const updated = current.replace(old_text, new_text);
              setDraftContent(updated);
              draftContentRef.current = updated;
              result = "已更新";
            } else {
              result = "未找到匹配文本";
            }
          } else {
            result = `未知工具: ${toolName}`;
          }

          const iframe = iframeRef.current;
          if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage(
              {
                type: "archon:tool-result",
                payload: { callId, result },
              },
              "*"
            );
          }
          break;
        }

        case "archon:streaming":
          setIsStreaming(!!data.payload);
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open, sendContext, sendToolsRegister]);

  const handleApply = useCallback(() => {
    onApply(draftContent);
    onOpenChange(false);
  }, [draftContent, onApply, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const Editor = EditorMap[editorType];
  const iframeSrc = assistAgentId ? `/embed/${assistAgentId}` : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[80vh] w-[90vw] max-w-[calc(100%-2rem)] sm:max-w-7xl flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* Left: Diff Editor */}
          <div className="relative flex w-1/2 flex-col border-r">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              Diff
            </div>
            <div className="flex-1 min-h-0">
              {open && (
                <Editor
                  original={originalContent}
                  value={draftContent}
                  readOnly={isStreaming}
                  onChange={setDraftContent}
                  className="h-full border-0"
                />
              )}
            </div>
            {isStreaming && (
              <div className="absolute inset-0 top-[33px] flex items-center justify-center bg-background/50">
                <Spinner className="size-5" />
              </div>
            )}
          </div>

          {/* Right: Embedded Assist Agent */}
          <div className="flex w-1/2 flex-col">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              AI 助手
            </div>
            <div className="flex-1 min-h-0">
              {iframeSrc ? (
                <iframe
                  ref={iframeRef}
                  src={iframeSrc}
                  className="h-full w-full border-0"
                  title="AI 助手"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {emptyHint}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!hasDiff}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
