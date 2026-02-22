"use client";

import { useCallback, useState } from "react";
import deepEqual from "fast-deep-equal";
import { nanoid } from "nanoid";
import {
  PlusIcon,
  PlayIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { AssertionRow } from "./assertion-row";
import { TurnsList } from "./turns-list";
import { ResultCard } from "./result-card";
import { useActiveModelConfig } from "@/lib/model-config/hooks";
import { useActiveJudgeConfig } from "@/lib/judge-config/hooks";
import { useEvalRuns } from "@/lib/eval/hooks";
import { useResolvedEvaluator } from "@/lib/eval/use-resolved-evaluator";
import { useTemplateVars } from "@/lib/eval/template-vars-hooks";
import { useTools } from "@/lib/tools/hooks";
import { useEvalRun } from "@/lib/eval/eval-run-context";
import type { EvalCaseRow } from "@/db/schema";
import type {
  Assertion,
  EvalResult,
  EvalCase,
  EvalCaseMode,
  EvalTurn,
  CreateEvalRunResponse,
  RunCaseResponse,
} from "@/lib/eval/types";

interface RunResultEntry {
  result: EvalResult;
  modelName: string;
}

interface CaseDetailProps {
  evalCase: EvalCaseRow;
  agentId?: string;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CaseDetail({ evalCase, agentId, onSave, onDelete }: CaseDetailProps) {
  const [name, setName] = useState(evalCase.name);
  const [mode, setMode] = useState<EvalCaseMode>(evalCase.mode);
  const [turns, setTurns] = useState<EvalTurn[]>(evalCase.turns);
  const [expectedOutput, setExpectedOutput] = useState(
    evalCase.expectedOutput ?? ""
  );
  const [assertions, setAssertions] = useState<Assertion[]>(
    evalCase.assertions
  );
  const [tags, setTags] = useState<string[]>(evalCase.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [runResults, setRunResults] = useState<RunResultEntry[]>([]);

  // Hooks for running
  const { activeConfig: activeModelConfig } = useActiveModelConfig(agentId);
  const { evaluator } = useResolvedEvaluator(agentId);
  const judgeAgentId = evaluator?.judgeAgentId ?? undefined;
  const { activeConfig: activeJudgeModelConfig } = useActiveModelConfig(judgeAgentId);
  const { activeConfig: activeJudgeConfig } = useActiveJudgeConfig(judgeAgentId);
  const { templateVars } = useTemplateVars(agentId);
  const { tools: allDbTools } = useTools(agentId);
  const { isRunning: isGlobalRunning } = useEvalRun();
  const { mutate: mutateRuns } = useEvalRuns(agentId);

  const busy = saving || deleting || running;

  const dirty =
    name !== evalCase.name ||
    mode !== evalCase.mode ||
    !deepEqual(turns, evalCase.turns) ||
    expectedOutput !== (evalCase.expectedOutput ?? "") ||
    !deepEqual(assertions, evalCase.assertions) ||
    !deepEqual(tags, evalCase.tags ?? []);

  const handleAssertionChange = useCallback(
    (idx: number, updated: Assertion) => {
      setAssertions((prev) =>
        prev.map((a, i) => (i === idx ? updated : a))
      );
    },
    []
  );

  const handleAssertionDelete = useCallback((idx: number) => {
    setAssertions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleAddAssertion = useCallback(() => {
    setAssertions((prev) => [
      ...prev,
      { id: nanoid(), type: "contains", value: "" },
    ]);
  }, []);

  const handleAddTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().toLowerCase();
      if (tag && !tags.includes(tag)) {
        setTags((prev) => [...prev, tag]);
      }
      setTagInput("");
    },
    [tags]
  );

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        handleAddTag(tagInput);
      }
    },
    [tagInput, handleAddTag]
  );

  const handleModeChange = useCallback(
    (newMode: EvalCaseMode) => {
      setMode(newMode);
      // When switching to single, ensure at least one user turn exists
      if (newMode === "single" && (turns.length === 0 || turns[0]?.role !== "user")) {
        setTurns([{ id: nanoid(), role: "user", content: turns[0]?.content ?? "" }]);
      }
      // When switching from single, keep existing turns
    },
    [turns]
  );

  // For single mode: map single textarea to turns[0].content
  const singleInput = turns[0]?.content ?? "";
  const handleSingleInputChange = useCallback(
    (content: string) => {
      if (turns.length === 0) {
        setTurns([{ id: nanoid(), role: "user", content }]);
      } else {
        setTurns(turns.map((t, i) => (i === 0 ? { ...t, content } : t)));
      }
    },
    [turns]
  );

  const handleReset = useCallback(() => {
    setName(evalCase.name);
    setMode(evalCase.mode);
    setTurns(evalCase.turns);
    setExpectedOutput(evalCase.expectedOutput ?? "");
    setAssertions(evalCase.assertions);
    setTags(evalCase.tags ?? []);
    setTagInput("");
  }, [evalCase]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(evalCase.id, {
        name,
        mode,
        turns,
        expectedOutput: expectedOutput || null,
        assertions,
        tags,
      });
    } finally {
      setSaving(false);
    }
  }, [evalCase.id, name, mode, turns, expectedOutput, assertions, tags, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(evalCase.id);
    } finally {
      setDeleting(false);
    }
  }, [evalCase.id, onDelete]);

  const makeErrorResult = (error: string): EvalResult => ({
    caseId: evalCase.id,
    caseName: name,
    mode,
    turns,
    chatMessages: [],
    turnResults: [],
    chatResponse: "",
    assertionResults: [],
    allAssertionsPassed: false,
    judgeResult: null,
    timestamp: Date.now(),
    durationMs: 0,
    error,
  });

  const canRun = !!(activeModelConfig && judgeAgentId && activeJudgeModelConfig && activeJudgeConfig);

  const handleRun = useCallback(async () => {
    if (!activeModelConfig || !judgeAgentId || !activeJudgeModelConfig || !activeJudgeConfig) {
      toast.error("Missing model config, judge agent, or judge config");
      return;
    }

    const currentCase: EvalCase = {
      id: evalCase.id,
      key: evalCase.key,
      name,
      mode,
      turns,
      assertions,
      expectedOutput,
      tags,
    };
    const enabledToolNames = allDbTools
      .filter((t) => t.enabled)
      .map((t) => t.name);
    const modelName = activeModelConfig.name;

    setRunning(true);

    // Step 1: Create run record
    let runId: string;
    try {
      const createRes = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          modelConfigId: activeModelConfig.id,
          judgeAgentId,
          judgeModelConfigId: activeJudgeModelConfig.id,
          judgeConfigId: activeJudgeConfig.id,
          totalCases: 1,
        }),
      });
      if (!createRes.ok) {
        throw new Error(
          `HTTP ${createRes.status}: ${await createRes.text()}`
        );
      }
      const { runId: id }: CreateEvalRunResponse = await createRes.json();
      runId = id;
    } catch (err) {
      setRunning(false);
      setRunResults((prev) => [
        {
          modelName,
          result: makeErrorResult(err instanceof Error ? err.message : String(err)),
        },
        ...prev,
      ]);
      return;
    }

    // Step 2: Execute the case
    let result: EvalResult;
    try {
      const res = await fetch(`/api/eval/run/${runId}/case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case: currentCase,
          judgeModelConfigId: activeJudgeModelConfig.id,
          judgeConfigId: activeJudgeConfig.id,
          modelConfigId: activeModelConfig.id,
          templateVars,
          toolNames: enabledToolNames,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        result = makeErrorResult(`HTTP ${res.status}: ${errText}`);
      } else {
        const data: RunCaseResponse = await res.json();
        result = data.result;
      }
    } catch (err) {
      result = makeErrorResult(err instanceof Error ? err.message : String(err));
    }

    // Step 3: Finalize the run
    try {
      await fetch(`/api/eval/run/${runId}`, { method: "PATCH" });
    } catch {
      // Non-critical: stats may be stale but results are saved
    }

    setRunResults((prev) => [{ result, modelName }, ...prev]);
    setRunning(false);
    mutateRuns();
  }, [
    evalCase.id,
    evalCase.key,
    agentId,
    name,
    mode,
    turns,
    assertions,
    expectedOutput,
    tags,
    activeModelConfig,
    judgeAgentId,
    activeJudgeModelConfig,
    activeJudgeConfig,
    templateVars,
    allDbTools,
    mutateRuns,
  ]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Key
            </label>
            <Input
              className="mt-1 h-8 text-sm font-mono bg-muted"
              value={evalCase.key}
              readOnly
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Case Name
            </label>
            <Input
              className="mt-1 h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Case name..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tags
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
              <Input
                className="h-6 min-w-[80px] flex-1 border-none px-1 text-xs shadow-none focus-visible:ring-0"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput.trim() && handleAddTag(tagInput)}
                placeholder="Add tag..."
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Mode
            </label>
            <Select value={mode} onValueChange={(v) => handleModeChange(v as EvalCaseMode)}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single" className="text-xs">
                  Single (one question)
                </SelectItem>
                <SelectItem value="injected" className="text-xs">
                  Injected (history + last question)
                </SelectItem>
                <SelectItem value="sequential" className="text-xs">
                  Sequential (multi-turn conversation)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "single" ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Input (User Message)
              </label>
              <Textarea
                className="mt-1 min-h-[60px] resize-none text-sm"
                value={singleInput}
                onChange={(e) => handleSingleInputChange(e.target.value)}
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
                  turns={turns}
                  mode={mode}
                  onTurnsChange={setTurns}
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
              value={expectedOutput}
              onChange={(e) => setExpectedOutput(e.target.value)}
              placeholder="Expected output (optional)..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Assertions
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddAssertion}
              >
                <PlusIcon className="mr-1 size-3" />
                Add
              </Button>
            </div>
            <div className="mt-1 space-y-2">
              {assertions.map((a, idx) => (
                <AssertionRow
                  key={a.id}
                  assertion={a}
                  onChange={(updated) => handleAssertionChange(idx, updated)}
                  onDelete={() => handleAssertionDelete(idx)}
                />
              ))}
              {assertions.length === 0 && (
                <p className="py-2 text-xs text-muted-foreground">
                  No assertions. Add one to validate the response.
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRun}
          disabled={busy || isGlobalRunning || !canRun}
        >
          {running ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <PlayIcon className="mr-1 size-3" />
          )}
          {running ? "Running..." : "Run"}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy || !dirty}
        >
          {saving ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <SaveIcon className="mr-1 size-3" />
          )}
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={busy || !dirty}
        >
          <RotateCcwIcon className="mr-1 size-3" />
          Reset
        </Button>
        <div className="flex-1" />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
        >
          {deleting ? (
            <Spinner className="mr-1 size-3" />
          ) : (
            <Trash2Icon className="mr-1 size-3" />
          )}
          {deleting ? "Deleting..." : "Delete"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Eval Case"
        description={`Are you sure you want to delete "${evalCase.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />

      {/* Run results */}
      {runResults.length > 0 && (
        <ScrollArea className="max-h-[40vh] border-t">
          <div className="space-y-3 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">
              Run Results ({runResults.length})
            </h3>
            {runResults.map((entry, i) => (
              <div key={`${entry.result.timestamp}-${i}`}>
                <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{new Date(entry.result.timestamp).toLocaleTimeString()}</span>
                  <span>{entry.modelName}</span>
                </div>
                <ResultCard result={entry.result} />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
