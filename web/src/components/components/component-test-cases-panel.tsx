"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  useComponentTestCases,
  createComponentTestCase,
  updateComponentTestCase,
  deleteComponentTestCase,
  useComponentTestRuns,
  fetchComponentTestRunDetail,
  deleteComponentTestRun,
  type ComponentTestRunDetail,
} from "@/lib/components/test-case-hooks";
import {
  ComponentTestCaseItem,
  type ComponentTestRunResult,
} from "./component-test-case-item";
import { ComponentTestCaseCreateForm } from "./component-test-case-create-form";
import { ComponentRunResultCard } from "./component-run-result-card";
import { ComponentRunHistoryItem } from "./component-run-history-item";
import type { ComponentTestRunResultRow } from "@/db/schema";
import { compileComponentGraph, keyToPascal, type ComponentRecord } from "@/tool-ui";

interface ComponentTestCasesPanelProps {
  componentId: string;
  componentSource: string;
  componentKey?: string;
  allComponents?: ComponentRecord[];
}

/** Execute a component render test on the client side. */
async function executeRenderTest(
  componentSource: string,
  tool: { name: string; input: unknown; output: unknown },
  extraDeps?: Record<string, unknown>
): Promise<ComponentTestRunResult> {
  const start = performance.now();
  try {
    // Dynamically import compile and render utilities
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { compileSourceWithDeps } = await import("@/tool-ui/_dynamic-renderer");

    const Comp = compileSourceWithDeps(componentSource, extraDeps);

    // Render to string to check for errors
    renderToStaticMarkup(
      createElement(Comp, {
        tool,
        state: "output-available",
        isLoading: false,
        isComplete: true,
        isError: false,
      })
    );

    const durationMs = Math.round(performance.now() - start);
    return { passed: true, durationMs };
  } catch (e) {
    const durationMs = Math.round(performance.now() - start);
    const error = e instanceof Error ? e.message : String(e);
    return { passed: false, error, durationMs };
  }
}

export function ComponentTestCasesPanel({
  componentId,
  componentSource,
  componentKey,
  allComponents,
}: ComponentTestCasesPanelProps) {
  const { testCases, mutate: mutateCases } =
    useComponentTestCases(componentId);
  const { runs, mutate: mutateRuns } = useComponentTestRuns(componentId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [runAllRunning, setRunAllRunning] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [currentRunResults, setCurrentRunResults] = useState<
    ComponentTestRunResultRow[]
  >([]);
  const [currentRunOpen, setCurrentRunOpen] = useState(true);
  const [runProgress, setRunProgress] = useState<{
    done: number;
    total: number;
    passed: number;
  } | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetailCache, setRunDetailCache] = useState<
    Record<string, ComponentTestRunDetail>
  >({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  // Compute extra deps from component graph for composition
  const compositionDeps = useMemo(() => {
    if (!componentKey || !allComponents?.length) return undefined;
    try {
      const compiled = compileComponentGraph(allComponents);
      const deps: Record<string, unknown> = {};
      for (const [key, comp] of compiled) {
        if (key !== componentKey) {
          deps[keyToPascal(key)] = comp;
        }
      }
      return Object.keys(deps).length > 0 ? deps : undefined;
    } catch {
      return undefined;
    }
  }, [componentKey, allComponents]);

  // All unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    testCases.forEach((tc) => tc.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [testCases]);

  // Filtered cases
  const filteredCases = useMemo(
    () =>
      selectedTag
        ? testCases.filter((tc) => tc.tags.includes(selectedTag))
        : testCases,
    [testCases, selectedTag]
  );

  // ── CRUD handlers ──

  const handleCreate = useCallback(
    async (data: {
      name: string;
      tool: { name: string; input: unknown; output: unknown };
      tags: string[];
    }) => {
      await createComponentTestCase(componentId, data, mutateCases);
      setShowCreateForm(false);
    },
    [componentId, mutateCases]
  );

  const handleSave = useCallback(
    async (
      caseId: string,
      data: {
        name?: string;
        tool?: { name: string; input: unknown; output: unknown };
        tags?: string[];
        showAsExample?: boolean;
      }
    ) => {
      await updateComponentTestCase(componentId, caseId, data, mutateCases);
    },
    [componentId, mutateCases]
  );

  const handleDelete = useCallback(
    async (caseId: string) => {
      await deleteComponentTestCase(componentId, caseId, mutateCases);
    },
    [componentId, mutateCases]
  );

  // ── Single test run (client-side) ──

  const handleRun = useCallback(
    async (
      tool: { name: string; input: unknown; output: unknown }
    ): Promise<ComponentTestRunResult> => {
      return executeRenderTest(componentSource, tool, compositionDeps);
    },
    [componentSource, compositionDeps]
  );

  // ── Run All ──

  const handleRunAll = useCallback(async () => {
    if (filteredCases.length === 0) return;
    setRunAllRunning(true);
    setCurrentRunResults([]);
    setCurrentRunOpen(true);
    setRunProgress({ done: 0, total: filteredCases.length, passed: 0 });

    try {
      // 1. Create run record
      const createRes = await fetch(
        `/api/components/${componentId}/test-runs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filterTags: selectedTag ? [selectedTag] : [],
            totalCases: filteredCases.length,
          }),
        }
      );
      const { runId } = await createRes.json();

      // 2. Execute each case
      let passed = 0;
      for (let i = 0; i < filteredCases.length; i++) {
        const tc = filteredCases[i];
        const result = await executeRenderTest(componentSource, tc.tool, compositionDeps);
        if (result.passed) passed++;

        // 3. Save result
        const saveRes = await fetch(
          `/api/components/${componentId}/test-runs/${runId}/case`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              caseId: tc.id,
              caseName: tc.name,
              tool: tc.tool,
              passed: result.passed,
              error: result.error ?? null,
              durationMs: result.durationMs,
            }),
          }
        );
        const { result: savedResult } = await saveRes.json();
        setCurrentRunResults((prev) => [...prev, savedResult]);
        setRunProgress({
          done: i + 1,
          total: filteredCases.length,
          passed,
        });
      }

      // 4. Finalize
      await fetch(
        `/api/components/${componentId}/test-runs/${runId}`,
        { method: "PATCH" }
      );
      mutateRuns();
    } finally {
      setRunAllRunning(false);
    }
  }, [filteredCases, componentId, componentSource, selectedTag, mutateRuns, compositionDeps]);

  // ── Run history handlers ──

  const handleToggleRunDetail = useCallback(
    async (runId: string) => {
      if (expandedRunId === runId) {
        setExpandedRunId(null);
        return;
      }
      setExpandedRunId(runId);
      if (runDetailCache[runId]) return;

      setLoadingDetail(runId);
      const detail = await fetchComponentTestRunDetail(componentId, runId);
      if (detail) {
        setRunDetailCache((prev) => ({ ...prev, [runId]: detail }));
      }
      setLoadingDetail(null);
    },
    [expandedRunId, runDetailCache, componentId]
  );

  const handleDeleteRun = useCallback(
    async (runId: string) => {
      setDeletingRunId(runId);
      await deleteComponentTestRun(componentId, runId, mutateRuns);
      if (expandedRunId === runId) setExpandedRunId(null);
      setDeletingRunId(null);
    },
    [componentId, mutateRuns, expandedRunId]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        {allTags.length > 0 && (
          <div className="flex items-center gap-1">
            {selectedTag && (
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-accent"
              >
                <XIcon className="size-3" />
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTag(selectedTag === tag ? null : tag)
                }
                className={`rounded-full px-2 py-0.5 text-xs ${
                  selectedTag === tag
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
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
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 pb-3 pt-3">
          {/* Test Cases */}
          <div className="space-y-3">
            {filteredCases.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {testCases.length === 0
                  ? "No test cases yet"
                  : "No cases match selected tags"}
              </p>
            ) : (
              filteredCases.map((tc) => (
                <ComponentTestCaseItem
                  key={tc.id}
                  testCase={tc}
                  componentSource={componentSource}
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
              {currentRunResults.length > 0 &&
                (() => {
                  const passedCount = currentRunResults.filter(
                    (r) => r.passed
                  ).length;
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
                        <span className="shrink-0 font-medium">
                          {passedCount}/{total}
                        </span>
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
                            <ComponentRunResultCard
                              key={r.id}
                              result={r}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* History runs */}
              {runs.map((run) => (
                <ComponentRunHistoryItem
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
          <ComponentTestCaseCreateForm
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
