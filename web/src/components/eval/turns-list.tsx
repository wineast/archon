"use client";

import { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import {
  PlusIcon,
  ImportIcon,
  Trash2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  WrenchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AssertionRow } from "./assertion-row";
import { ToolCallRow } from "./tool-call-row";
import { ImportTurnsDialog } from "./import-turns-dialog";
import type { Assertion, EvalCaseMode, EvalTurn, EvalTurnToolCall } from "@/lib/eval/types";

interface TurnsListProps {
  turns: EvalTurn[];
  mode: EvalCaseMode;
  onTurnsChange: (turns: EvalTurn[]) => void;
}

export function TurnsList({ turns, mode, onTurnsChange }: TurnsListProps) {
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = useCallback(
    (imported: EvalTurn[]) => {
      onTurnsChange(imported);
    },
    [onTurnsChange]
  );

  const handleAdd = useCallback(() => {
    onTurnsChange([
      ...turns,
      { id: nanoid(), role: "user", content: "" },
    ]);
  }, [turns, onTurnsChange]);

  const handleRemove = useCallback(
    (idx: number) => {
      onTurnsChange(turns.filter((_, i) => i !== idx));
    },
    [turns, onTurnsChange]
  );

  const handleMove = useCallback(
    (idx: number, dir: -1 | 1) => {
      const target = idx + dir;
      if (target < 0 || target >= turns.length) return;
      const next = [...turns];
      [next[idx], next[target]] = [next[target], next[idx]];
      onTurnsChange(next);
    },
    [turns, onTurnsChange]
  );

  const handleRoleChange = useCallback(
    (idx: number, role: "user" | "assistant") => {
      onTurnsChange(
        turns.map((t, i) =>
          i === idx ? { ...t, role } : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleContentChange = useCallback(
    (idx: number, content: string) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === idx ? { ...t, content } : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleJudgeToggle = useCallback(
    (idx: number, checked: boolean) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === idx ? { ...t, judge: checked } : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleExpectedOutputChange = useCallback(
    (idx: number, expectedOutput: string) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === idx ? { ...t, expectedOutput } : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleAddAssertion = useCallback(
    (idx: number) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === idx
            ? {
                ...t,
                assertions: [
                  ...(t.assertions ?? []),
                  { id: nanoid(), type: "contains" as const, value: "" },
                ],
              }
            : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleAssertionChange = useCallback(
    (turnIdx: number, assertionIdx: number, updated: Assertion) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === turnIdx
            ? {
                ...t,
                assertions: (t.assertions ?? []).map((a, j) =>
                  j === assertionIdx ? updated : a
                ),
              }
            : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleAssertionDelete = useCallback(
    (turnIdx: number, assertionIdx: number) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === turnIdx
            ? {
                ...t,
                assertions: (t.assertions ?? []).filter(
                  (_, j) => j !== assertionIdx
                ),
              }
            : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  // ── Tool call handlers ──

  const handleAddToolCall = useCallback(
    (idx: number) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === idx
            ? {
                ...t,
                toolCalls: [
                  ...(t.toolCalls ?? []),
                  { name: "", args: {}, result: "" },
                ],
              }
            : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleToolCallChange = useCallback(
    (turnIdx: number, tcIdx: number, updated: EvalTurnToolCall) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === turnIdx
            ? {
                ...t,
                toolCalls: (t.toolCalls ?? []).map((tc, j) =>
                  j === tcIdx ? updated : tc
                ),
              }
            : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  const handleToolCallDelete = useCallback(
    (turnIdx: number, tcIdx: number) => {
      onTurnsChange(
        turns.map((t, i) =>
          i === turnIdx
            ? {
                ...t,
                toolCalls: (t.toolCalls ?? []).filter(
                  (_, j) => j !== tcIdx
                ),
              }
            : t
        )
      );
    },
    [turns, onTurnsChange]
  );

  return (
    <div className="space-y-3">
      {turns.map((turn, idx) => (
        <div
          key={turn.id}
          className="rounded-md border p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              #{idx + 1}
            </span>
            <Select
              value={turn.role}
              onValueChange={(v) =>
                handleRoleChange(idx, v as "user" | "assistant")
              }
            >
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user" className="text-xs">
                  User
                </SelectItem>
                <SelectItem value="assistant" className="text-xs">
                  Assistant
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleMove(idx, -1)}
              disabled={idx === 0}
            >
              <ChevronUpIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleMove(idx, 1)}
              disabled={idx === turns.length - 1}
            >
              <ChevronDownIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleRemove(idx)}
            >
              <Trash2Icon className="size-3" />
            </Button>
          </div>

          <Textarea
            className="min-h-[40px] max-h-[200px] resize-none text-sm"
            value={turn.content}
            onChange={(e) => handleContentChange(idx, e.target.value)}
            placeholder={
              turn.role === "user"
                ? "User message..."
                : "Assistant response..."
            }
          />

          {/* Tool calls section (assistant turns only, injected/sequential modes) */}
          {turn.role === "assistant" && mode !== "single" && (
            <div className="space-y-2 pl-3 border-l-2 border-blue-200">
              <div className="flex items-center gap-2">
                <WrenchIcon className="size-3 text-blue-500" />
                <span className="text-xs text-muted-foreground">Tool Calls</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleAddToolCall(idx)}
                >
                  <PlusIcon className="mr-1 size-3" />
                  Add Tool Call
                </Button>
              </div>
              {(turn.toolCalls ?? []).map((tc, tcIdx) => (
                <ToolCallRow
                  key={tcIdx}
                  toolCall={tc}
                  onChange={(updated) =>
                    handleToolCallChange(idx, tcIdx, updated)
                  }
                  onDelete={() => handleToolCallDelete(idx, tcIdx)}
                />
              ))}
            </div>
          )}

          {/* Per-turn assertions + judge (sequential mode, user turns only) */}
          {mode === "sequential" && turn.role === "user" && (
            <div className="space-y-2 pl-3 border-l-2 border-muted">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id={`judge-${turn.id}`}
                    checked={turn.judge ?? false}
                    onCheckedChange={(checked) =>
                      handleJudgeToggle(idx, !!checked)
                    }
                  />
                  <label
                    htmlFor={`judge-${turn.id}`}
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Judge this turn
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleAddAssertion(idx)}
                >
                  <PlusIcon className="mr-1 size-3" />
                  Assertion
                </Button>
              </div>
              {turn.judge && (
                <Textarea
                  className="min-h-[32px] resize-none text-xs"
                  value={turn.expectedOutput ?? ""}
                  onChange={(e) =>
                    handleExpectedOutputChange(idx, e.target.value)
                  }
                  placeholder="Expected output for this turn (optional)..."
                />
              )}
              {(turn.assertions ?? []).map((a, aIdx) => (
                <AssertionRow
                  key={a.id}
                  assertion={a}
                  onChange={(updated) =>
                    handleAssertionChange(idx, aIdx, updated)
                  }
                  onDelete={() => handleAssertionDelete(idx, aIdx)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleAdd}
        >
          <PlusIcon className="mr-1 size-3" />
          Add Turn
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
        >
          <ImportIcon className="mr-1 size-3" />
          Import
        </Button>
      </div>

      <ImportTurnsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        hasExistingTurns={turns.length > 0}
      />
    </div>
  );
}
