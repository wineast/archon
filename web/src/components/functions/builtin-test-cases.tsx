"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  PlayIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { BuiltinTestCase } from "@/lib/functions/builtin";

interface RunResult {
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  passed: boolean;
}

function stableStringify(val: unknown): string {
  if (val === undefined) return "null";
  if (val === null) return "null";
  if (typeof val !== "object") return JSON.stringify(val);
  if (Array.isArray(val))
    return "[" + val.map(stableStringify).join(",") + "]";
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
    "}"
  );
}

interface BuiltinTestCaseItemProps {
  builtinKey: string;
  testCase: BuiltinTestCase;
  runResult?: RunResult;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}

function BuiltinTestCaseItem({
  builtinKey,
  testCase,
  runResult,
  busy,
  onBusyChange,
}: BuiltinTestCaseItemProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [localResult, setLocalResult] = useState<RunResult | null>(null);
  const result = runResult ?? localResult;

  const handleRun = useCallback(async () => {
    setRunning(true);
    onBusyChange(true);
    try {
      const res = await fetch("/api/functions/builtin/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: builtinKey, input: testCase.input }),
      });
      const data = await res.json();
      const passed = data.success
        ? stableStringify(data.result) ===
          stableStringify(testCase.expectedOutput)
        : false;
      setLocalResult({ ...data, passed });
    } catch (e) {
      setLocalResult({
        success: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: 0,
        passed: false,
      });
    } finally {
      setRunning(false);
      onBusyChange(false);
    }
  }, [builtinKey, testCase, onBusyChange]);

  const statusIcon = result ? (
    result.passed ? (
      <CheckCircle2Icon className="size-3.5 text-green-500" />
    ) : (
      <XCircleIcon className="size-3.5 text-destructive" />
    )
  ) : null;

  return (
    <div className="rounded-lg border">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <ChevronDownIcon
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="flex-1 truncate font-medium">{testCase.name}</span>
        {statusIcon}
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0"
          disabled={busy || running}
          onClick={(e) => {
            e.stopPropagation();
            handleRun();
          }}
        >
          {running ? (
            <Spinner className="size-3" />
          ) : (
            <PlayIcon className="size-3" />
          )}
        </Button>
      </div>

      {open && (
        <div className="space-y-2 border-t px-3 pb-3 pt-2">
          {testCase.description && (
            <p className="text-xs text-muted-foreground">
              {testCase.description}
            </p>
          )}

          <div>
            <label className="text-[10px] font-medium text-muted-foreground">
              Input
            </label>
            <pre className="mt-0.5 rounded bg-muted p-2 text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(testCase.input, null, 2)}
            </pre>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground">
              Expected Output
            </label>
            <pre className="mt-0.5 rounded bg-muted p-2 text-xs overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(testCase.expectedOutput, null, 2)}
            </pre>
          </div>

          {result && (
            <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {result.passed ? (
                    <span className="text-green-600">Passed</span>
                  ) : result.error ? (
                    <span className="text-destructive">Error</span>
                  ) : (
                    <span className="text-destructive">Failed</span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {result.durationMs}ms
                </span>
              </div>
              {result.error && (
                <p className="text-xs text-destructive whitespace-pre-wrap">
                  {result.error}
                </p>
              )}
              {result.success && result.result !== undefined && (
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Actual Output
                  </label>
                  <pre className={`mt-0.5 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap ${
                    !result.passed ? "bg-destructive/10" : "bg-muted"
                  }`}>
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface BuiltinTestCasesProps {
  builtinKey: string;
  testCases: BuiltinTestCase[];
}

export function BuiltinTestCases({
  builtinKey,
  testCases,
}: BuiltinTestCasesProps) {
  const [busy, setBusy] = useState(false);
  const [runAllRunning, setRunAllRunning] = useState(false);
  const [runAllResults, setRunAllResults] = useState<
    Record<number, RunResult>
  >({});

  const handleRunAll = useCallback(async () => {
    setRunAllRunning(true);
    setBusy(true);
    const results: Record<number, RunResult> = {};

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const res = await fetch("/api/functions/builtin/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: builtinKey, input: tc.input }),
        });
        const data = await res.json();
        const passed = data.success
          ? stableStringify(data.result) ===
            stableStringify(tc.expectedOutput)
          : false;
        results[i] = { ...data, passed };
      } catch (e) {
        results[i] = {
          success: false,
          error: e instanceof Error ? e.message : String(e),
          durationMs: 0,
          passed: false,
        };
      }
      setRunAllResults({ ...results });
    }

    setRunAllRunning(false);
    setBusy(false);
  }, [builtinKey, testCases]);

  const passedCount = Object.values(runAllResults).filter((r) => r.passed).length;
  const totalRan = Object.keys(runAllResults).length;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="flex-1" />
        {totalRan > 0 && (
          <span className="text-xs text-muted-foreground">
            {passedCount}/{testCases.length} passed
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleRunAll}
          disabled={runAllRunning}
          className="gap-1"
        >
          {runAllRunning ? (
            <Spinner className="size-3" />
          ) : (
            <PlayIcon className="size-3" />
          )}
          Run All
        </Button>
      </div>

      {/* Scrollable list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 px-4 pb-3">
          {testCases.map((tc, i) => (
            <BuiltinTestCaseItem
              key={i}
              builtinKey={builtinKey}
              testCase={tc}
              runResult={runAllResults[i]}
              busy={busy}
              onBusyChange={setBusy}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
