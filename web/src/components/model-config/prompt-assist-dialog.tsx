"use client";

import { AssistDialog } from "@/components/assist/assist-dialog";

interface PromptAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemPrompt: string;
  onApply: (newPrompt: string) => void;
  agentId?: string;
  orgId?: string;
}

export function PromptAssistDialog({
  open,
  onOpenChange,
  systemPrompt,
  onApply,
  agentId,
}: PromptAssistDialogProps) {
  return (
    <AssistDialog
      open={open}
      onOpenChange={onOpenChange}
      content={systemPrompt}
      onApply={onApply}
      agentId={agentId}
      editorType="md"
      title="AI 辅助编辑提示词"
      fieldContext="system-prompt"
      placeholder="描述你想要的修改..."
    />
  );
}
