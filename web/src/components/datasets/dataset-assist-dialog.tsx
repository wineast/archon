"use client";

import { AssistDialog } from "@/components/assist/assist-dialog";

interface DatasetAssistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: string;
  datasetName?: string;
  datasetDescription?: string;
  templateVariables?: string[];
  agentId?: string;
  orgId?: string;
  onApply: (newData: string) => void;
}

export function DatasetAssistDialog({
  open,
  onOpenChange,
  data,
  agentId,
  orgId,
  onApply,
}: DatasetAssistDialogProps) {
  return (
    <AssistDialog
      open={open}
      onOpenChange={onOpenChange}
      content={data}
      onApply={onApply}
      agentId={agentId}
      orgId={orgId}
      editorType="json"
      title="AI 辅助编辑数据"
      fieldContext="dataset-data"
      placeholder="描述你想要的数据修改..."
    />
  );
}
