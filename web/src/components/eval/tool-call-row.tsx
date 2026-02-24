"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { EvalTurnToolCall } from "@/lib/eval/types";
import { Trash2Icon } from "lucide-react";

interface ToolCallRowProps {
  toolCall: EvalTurnToolCall;
  onChange: (updated: EvalTurnToolCall) => void;
  onDelete: () => void;
}

export function ToolCallRow({ toolCall, onChange, onDelete }: ToolCallRowProps) {
  return (
    <div className="flex gap-2">
      <div className="flex-1 space-y-1.5">
        <Input
          className="h-7 text-xs"
          value={toolCall.name}
          onChange={(e) => onChange({ ...toolCall, name: e.target.value })}
          placeholder="Tool name"
        />
        <Textarea
          className="min-h-[32px] max-h-[200px] resize-none text-xs font-mono"
          value={typeof toolCall.args === "string" ? toolCall.args : JSON.stringify(toolCall.args, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange({ ...toolCall, args: parsed });
            } catch {
              // Keep raw string during editing — store as-is
              onChange({ ...toolCall, args: e.target.value as unknown as Record<string, unknown> });
            }
          }}
          placeholder='{"key": "value"}'
        />
        <Textarea
          className="min-h-[32px] max-h-[200px] resize-none text-xs font-mono"
          value={toolCall.result}
          onChange={(e) => onChange({ ...toolCall, result: e.target.value })}
          placeholder="Tool result..."
        />
      </div>
      <Button variant="ghost" size="sm" onClick={onDelete} className="mt-0.5 size-7 p-0">
        <Trash2Icon className="size-3" />
      </Button>
    </div>
  );
}
