"use client";

import { AssistDialog } from "@/components/assist/assist-dialog";

interface FunctionCodeAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  context?: string;
  onApply: (newCode: string) => void;
  agentId?: string;
  orgId?: string;
}

export function FunctionCodeAssistDialog({
  open,
  onOpenChange,
  code,
  onApply,
  agentId,
  orgId,
}: FunctionCodeAssistDialogProps) {
  return (
    <AssistDialog
      open={open}
      onOpenChange={onOpenChange}
      content={code}
      onApply={onApply}
      agentId={agentId}
      orgId={orgId}
      editorType="js"
      title="AI 辅助编辑函数"
      fieldContext="function-code"
      placeholder="描述你想要的函数逻辑..."
    />
  );
}
