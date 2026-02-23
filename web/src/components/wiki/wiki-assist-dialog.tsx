"use client";

import { AssistDialog } from "@/components/assist/assist-dialog";

interface WikiAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  documentName?: string;
  agentId?: string;
  onApply: (newContent: string) => void;
}

export function WikiAssistDialog({
  open,
  onOpenChange,
  content,
  agentId,
  onApply,
}: WikiAssistDialogProps) {
  return (
    <AssistDialog
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      onApply={onApply}
      agentId={agentId}
      editorType="md"
      title="AI 辅助编辑文档"
      fieldContext="wiki-content"
      placeholder="描述你想要的文档修改..."
    />
  );
}
