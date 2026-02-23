"use client";

import { AssistDialog } from "@/components/assist/assist-dialog";

interface SchemaCodeAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: string;
  context?: string;
  onApply: (newSchema: string) => void;
  agentId?: string;
}

export function SchemaCodeAssistDialog({
  open,
  onOpenChange,
  schema,
  onApply,
  agentId,
}: SchemaCodeAssistDialogProps) {
  return (
    <AssistDialog
      open={open}
      onOpenChange={onOpenChange}
      content={schema}
      onApply={onApply}
      agentId={agentId}
      editorType="json"
      title="AI 辅助编辑 Schema"
      fieldContext="schema"
      placeholder="描述你想要的 Schema 结构..."
    />
  );
}
