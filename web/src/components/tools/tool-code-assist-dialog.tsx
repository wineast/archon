"use client";

import { AssistDialog } from "@/components/assist/assist-dialog";

interface ToolCodeAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  toolName?: string;
  toolDescription?: string;
  agentId?: string;
  orgId?: string;
  onApply: (newCode: string) => void;
}

export function ToolCodeAssistDialog({
  open,
  onOpenChange,
  code,
  agentId,
  onApply,
}: ToolCodeAssistDialogProps) {
  return (
    <AssistDialog
      open={open}
      onOpenChange={onOpenChange}
      content={code}
      onApply={onApply}
      agentId={agentId}
      editorType="js"
      title="AI 辅助编辑 Handler"
      fieldContext="tool-handler"
      placeholder="描述你想要的 Handler 逻辑..."
    />
  );
}
