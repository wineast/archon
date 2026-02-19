"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Assertion, EvalCase, EvalCaseMode } from "@/lib/eval/types";
import { nanoid } from "nanoid";
import { useCallback, useState } from "react";
import { AssertionRow } from "./assertion-row";
import { TurnsList } from "./turns-list";
import { PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";

interface CaseFormProps {
  evalCase: EvalCase;
  onSave: (updated: EvalCase) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function CaseForm({ evalCase, onSave, onDelete, onCancel }: CaseFormProps) {
  const [draft, setDraft] = useState<EvalCase>({ ...evalCase });

  const singleInput = draft.turns[0]?.content ?? "";

  const handleAssertionChange = useCallback(
    (idx: number, updated: Assertion) => {
      setDraft((d) => ({
        ...d,
        assertions: d.assertions.map((a, i) => (i === idx ? updated : a)),
      }));
    },
    []
  );

  const handleAssertionDelete = useCallback((idx: number) => {
    setDraft((d) => ({
      ...d,
      assertions: d.assertions.filter((_, i) => i !== idx),
    }));
  }, []);

  const handleAddAssertion = useCallback(() => {
    setDraft((d) => ({
      ...d,
      assertions: [
        ...d.assertions,
        { id: nanoid(), type: "contains", value: "" },
      ],
    }));
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Key
        </label>
        <Input
          className="mt-1 h-8 text-sm font-mono bg-muted"
          value={draft.key}
          readOnly
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Case Name
        </label>
        <Input
          className="mt-1 h-8 text-sm"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Case name..."
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Mode
        </label>
        <Select
          value={draft.mode}
          onValueChange={(v) => {
            const newMode = v as EvalCaseMode;
            const newDraft = { ...draft, mode: newMode };
            if (newMode === "single" && (draft.turns.length === 0 || draft.turns[0]?.role !== "user")) {
              newDraft.turns = [{ id: nanoid(), role: "user", content: draft.turns[0]?.content ?? "" }];
            }
            setDraft(newDraft);
          }}
        >
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single" className="text-xs">
              Single
            </SelectItem>
            <SelectItem value="injected" className="text-xs">
              Injected
            </SelectItem>
            <SelectItem value="sequential" className="text-xs">
              Sequential
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {draft.mode === "single" ? (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Input (User Message)
          </label>
          <Textarea
            className="mt-1 min-h-[60px] resize-none text-sm"
            value={singleInput}
            onChange={(e) => {
              const content = e.target.value;
              if (draft.turns.length === 0) {
                setDraft({ ...draft, turns: [{ id: nanoid(), role: "user", content }] });
              } else {
                setDraft({
                  ...draft,
                  turns: draft.turns.map((t, i) => (i === 0 ? { ...t, content } : t)),
                });
              }
            }}
            placeholder="User message to send..."
          />
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Turns
          </label>
          <div className="mt-1">
            <TurnsList
              turns={draft.turns}
              mode={draft.mode}
              onTurnsChange={(turns) => setDraft({ ...draft, turns })}
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Expected Output (for judge reference)
        </label>
        <Textarea
          className="mt-1 min-h-[40px] resize-none text-sm"
          value={draft.expectedOutput}
          onChange={(e) =>
            setDraft({ ...draft, expectedOutput: e.target.value })
          }
          placeholder="Expected output (optional)..."
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Assertions
          </label>
          <Button variant="ghost" size="sm" onClick={handleAddAssertion}>
            <PlusIcon className="mr-1 size-3" />
            Add
          </Button>
        </div>
        <div className="mt-1 space-y-2">
          {draft.assertions.map((a, idx) => (
            <AssertionRow
              key={a.id}
              assertion={a}
              onChange={(updated) => handleAssertionChange(idx, updated)}
              onDelete={() => handleAssertionDelete(idx)}
            />
          ))}
          {draft.assertions.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No assertions. Add one to validate the response.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" onClick={() => onSave(draft)}>
          <SaveIcon className="mr-1 size-3" />
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          <XIcon className="mr-1 size-3" />
          Cancel
        </Button>
        <div className="flex-1" />
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2Icon className="mr-1 size-3" />
          Delete
        </Button>
      </div>
    </div>
  );
}
