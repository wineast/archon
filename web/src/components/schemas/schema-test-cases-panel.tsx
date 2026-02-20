"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { SchemaTestCaseItem } from "./schema-test-case-item";
import { SchemaTestCaseCreateForm } from "./schema-test-case-create-form";
import { SchemaRunResultCard } from "./schema-run-result-card";
import { SchemaRunHistoryItem } from "./schema-run-history-item";
import {
  useSchemaTestCases,
  createSchemaTestCase,
  updateSchemaTestCase,
  deleteSchemaTestCase,
  runSchemaTestCase,
  useSchemaTestRuns,
  fetchSchemaTestRunDetail,
  deleteSchemaTestRun,
  type SchemaTestRunDetail,
} from "@/lib/schemas/test-case-hooks";
import type { SchemaTestRunResultRow } from "@/db/schema";

interface SchemaTestCasesPanelProps {
  schemaId: string;
}

export function SchemaTestCasesPanel({
  schemaId,
}: SchemaTestCasesPanelProps) {
  const { testCases, isLoading, mutate } = useSchemaTestCases(schemaId);
  const { runs, mutate: mutateRuns } = useSchemaTestRuns(schemaId);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [runAllRunning, setRunAllRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{
    done: number;
    total: number;
    passed: number;
  } | null>(null);

  // Current run results (live, during execution)
  const [currentRunResults, setCurrentRunResults] = useState<
    SchemaTestRunResultRow[]
  >([]);
  const [currentRunOpen, setCurrentRunOpen] = useState(true);

  // History expansion state
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetailCache, setRunDetailCache] = useState<
    Record<string, SchemaTestRunDetail>
  >({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  // Collect all tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    testCases.forEach((c) => c.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [testCases]);

  // Filter by tags
  const filteredCases = useMemo(() => {
    if (selectedTags.length === 0) return testCases;
    return testCases.filter((c) =>
      selectedTags.some((t) => c.tags?.includes(t))
    );
  }, [testCases, selectedTags]);

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreate = useCallback(
    async (data: {
      name: string;
      input: Record<string, unknown>;
      shouldPass: boolean;
      expectedErrors?: Array<{ path: string; message: string }>;
      tags: string[];
    }) => {
      await createSchemaTestCase(schemaId, data, mutate);
      setShowCreateForm(false);
    },
    [schemaId, mutate]
  );

  const handleSave = useCallback(
    async (
      caseId: string,
      data: {
        name: string;
        input: Record<string, unknown>;
        shouldPass: boolean;
        expectedErrors?: Array<{ path: string; message: string }>;
        tags: string[];
      }
    ) => {
      await updateSchemaTestCase(schemaId, caseId, data, mutate);
    },
    [schemaId, mutate]
  );

  const handleDelete = useCallback(
    async (caseId: string) => {
      await deleteSchemaTestCase(schemaId, caseId, mutate);
    },
    [schemaId, mutate]
  );

  const handleRun = useCallback(
    async (
      input: Record<string, unknown>,
      shouldPass: boolean,
      expectedErrors?: Array<{ path: string; message: string }>
    ) => {
      return runSchemaTestCase(schemaId, input, shouldPass, expectedErrors);
    },
    [schemaId]
  );

  // Three-step persistent Run All
  const handleRunAll = useCallback(async () => {
    const cases = filteredCases;
    if (cases.length === 0) return;

    setRunAllRunning(true);
    setCurrentRunResults([]);
    const progress = { done: 0, total: cases.length, passed: 0 };
    setRunProgress({ ...progress });

    // Step 1: Create run record
    let runId: string;
    try {
      const createRes = await fetch(
        `/api/schemas/${schemaId}/test-runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filterTags: selectedTags.length > 0 ? selectedTags : [],
            totalCases: cases.length,
          }),
        }
      );
      if (!createRes.ok) {
        throw new Error(`Failed to create run: HTTP ${createRes.status}`);
      }
      const { runId: id } = await createRes.json();
      runId = id;
    } catch (err) {
      setRunAllRunning(false);
      setRunProgress(null);
      toast.error(err instanceof Error ? err.message : "Failed to create run");
      return;
    }

    // Step 2: Execute each case
    const allResults: SchemaTestRunResultRow[] = [];
    let passed = 0;

    for (const tc of cases) {
      try {
        const res = await fetch(
          `/api/schemas/${schemaId}/test-runs/${runId}/case`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              caseId: tc.id,
              caseName: tc.name,
              input: tc.input,
              shouldPass: tc.shouldPass,
              expectedErrors: tc.expectedErrors,
            }),
          }
        );
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        const { result } = (await res.json()) as {
          result: SchemaTestRunResultRow;
        };
        if (result.passed) passed++;
        allResults.push(result);
      } catch (err) {
        // Push a synthetic error result for display
        allResults.push({
          id: crypto.randomUUID(),
          runId,
          caseId: tc.id,
          caseName: tc.name,
          input: tc.input as Record<string, unknown>,
          shouldPass: tc.shouldPass,
          expectedErrors: tc.expectedErrors ?? null,
          actualValid: false,
          actualErrors: [{ path: "", message: err instanceof Error ? err.message : String(err) }],
          passed: false,
          durationMs: 0,
          createdAt: new Date(),
        });
      }
      progress.done++;
      progress.passed = passed;
      setRunProgress({ ...progress });
      setCurrentRunResults([...allResults]);
    }

    // Step 3: Finalize
    try {
      await fetch(
        `/api/schemas/${schemaId}/test-runs/${runId}`,
        { method: "PATCH" }
      );
    } catch {
      // Non-critical
    }

    setRunAllRunning(false);
    mutateRuns();
    toast.success(`Run All done: ${passed}/${cases.length} passed`);
  }, [filteredCases, schemaId, selectedTags, mutateRuns]);

  // History toggle
  const handleToggleRunDetail = useCallback(
    async (runId: string) => {
      if (expandedRunId === runId) {
        setExpandedRunId(null);
        return;
      }
      setExpandedRunId(runId);
      if (!runDetailCache[runId]) {
        setLoadingDetail(runId);
        const detail = await fetchSchemaTestRunDetail(schemaId, runId);
        if (detail) {
          setRunDetailCache((prev) => ({ ...prev, [runId]: detail }));
        }
        setLoadingDetail(null);
      }
    },
    [expandedRunId, runDetailCache, schemaId]
  );

  const handleDeleteRun = useCallback(
    async (runId: string) => {
      setDeletingRunId(runId);
      await deleteSchemaTestRun(schemaId, runId, mutateRuns);
      if (expandedRunId === runId) setExpandedRunId(null);
      setRunDetailCache((prev) => {
        const { [runId]: _, ...rest } = prev;
        return rest;
      });
      setDeletingRunId(null);
    },
    [schemaId, mutateRuns, expandedRunId]
  );

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: tag filters + Run All */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleToggleTag(tag)}
                className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                  selectedTags.includes(tag)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {runProgress && (
          <span className="text-xs text-muted-foreground">
            {runProgress.passed}/{runProgress.total} passed
            {runProgress.done < runProgress.total &&
              ` (${runProgress.done}/${runProgress.total})`}
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleRunAll}
          disabled={runAllRunning || filteredCases.length === 0}
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

      {/* Main scroll area */}
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="px-4 pb-3">
          {/* Test Cases */}
          <div className="space-y-2">
            {filteredCases.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {testCases.length === 0
                  ? "No test cases yet"
                  : "No cases match selected tags"}
              </p>
            ) : (
              filteredCases.map((tc) => (
                <SchemaTestCaseItem
                  key={tc.id}
                  testCase={tc}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onRun={handleRun}
                  busy={runAllRunning}
                />
              ))
            )}
          </div>

          {/* Runs (Current + History) */}
          {(currentRunResults.length > 0 || runs.length > 0) && (
            <div className="mt-4 space-y-1">
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
                Runs
              </h3>

              {/* Current Run */}
              {currentRunResults.length > 0 && (() => {
                const passedCount = currentRunResults.filter((r) => r.passed).length;
                const total = currentRunResults.length;
                return (
                  <div className="rounded-md border">
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent cursor-pointer"
                      onClick={() => setCurrentRunOpen(!currentRunOpen)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setCurrentRunOpen(!currentRunOpen);
                        }
                      }}
                    >
                      <ChevronDownIcon
                        className={`size-3 shrink-0 text-muted-foreground transition-transform ${currentRunOpen ? "" : "-rotate-90"}`}
                      />
                      {runAllRunning ? (
                        <Spinner className="size-3 shrink-0" />
                      ) : (
                        <PlayIcon className="size-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate font-medium">
                        Current Run
                      </span>
                      <span className="shrink-0 font-medium">{passedCount}/{total}</span>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentRunResults([]);
                          setRunProgress(null);
                        }}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                    {currentRunOpen && (
                      <div className="space-y-1 border-t px-3 py-2">
                        {currentRunResults.map((r) => (
                          <SchemaRunResultCard key={r.id} result={r} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* History runs */}
              {runs.map((run) => (
                <SchemaRunHistoryItem
                  key={run.id}
                  run={run}
                  expanded={expandedRunId === run.id}
                  detail={runDetailCache[run.id]}
                  loadingDetail={loadingDetail === run.id}
                  deletingRun={deletingRunId === run.id}
                  onToggle={() => handleToggleRunDetail(run.id)}
                  onDelete={() => handleDeleteRun(run.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom: add / create form */}
      <div className="border-t px-4 py-2">
        {showCreateForm ? (
          <SchemaTestCaseCreateForm
            onCreate={handleCreate}
            onCancel={() => setShowCreateForm(false)}
          />
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreateForm(true)}
            className="gap-1"
          >
            <PlusIcon className="size-3" />
            Add Test Case
          </Button>
        )}
      </div>
    </div>
  );
}
