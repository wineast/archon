"use client";

import { AssistDialog } from "@/components/assist/assist-dialog";

interface JsxAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jsxSource: string;
  onApply: (newSource: string) => void;
  agentId?: string;
  orgId?: string;
}

export function JsxAssistDialog({
  open,
  onOpenChange,
  jsxSource,
  onApply,
  agentId,
}: JsxAssistDialogProps) {
  return (
    <AssistDialog
      open={open}
      onOpenChange={onOpenChange}
      content={jsxSource}
      onApply={onApply}
      agentId={agentId}
      editorType="js"
      title="AI 辅助编辑组件"
      fieldContext="component-jsx"
      placeholder="描述你想要的组件效果..."
    />
  );
}
