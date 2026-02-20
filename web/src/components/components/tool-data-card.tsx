import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";

export interface ToolDataCardProps {
  toolName: string;
  inputValue: string;
  outputValue: string;
  onToolNameChange: (value: string) => void;
  onInputChange: (value: string) => void;
  onOutputChange: (value: string) => void;
  headerExtra?: ReactNode;
  inputExtra?: ReactNode;
  outputExtra?: ReactNode;
  inputHeight?: string;
  outputHeight?: string;
}

export function ToolDataCard({
  toolName,
  inputValue,
  outputValue,
  onToolNameChange,
  onInputChange,
  onOutputChange,
  headerExtra,
  inputExtra,
  outputExtra,
  inputHeight = "120px",
  outputHeight = "120px",
}: ToolDataCardProps) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">Tool</label>
        {headerExtra}
      </div>

      {/* Name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Name
        </label>
        <Input
          className="mt-1 h-8 text-sm"
          value={toolName}
          onChange={(e) => onToolNameChange(e.target.value)}
          placeholder="e.g. get_weather"
        />
      </div>

      {/* Input */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Input (JSON)
        </label>
        <JsonEditor
          value={inputValue}
          onChange={onInputChange}
          height={inputHeight}
          className="mt-1"
        />
        {inputExtra}
      </div>

      {/* Output */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Output (JSON)
        </label>
        <JsonEditor
          value={outputValue}
          onChange={onOutputChange}
          height={outputHeight}
          className="mt-1"
        />
        {outputExtra}
      </div>
    </div>
  );
}
