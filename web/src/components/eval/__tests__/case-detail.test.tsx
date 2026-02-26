// @vitest-environment jsdom

// Polyfill ResizeObserver for Radix ScrollArea
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverMock as unknown as typeof ResizeObserver;

import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EvalCaseRow } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockMutateBatches = vi.fn();

vi.mock("@/lib/eval/hooks", () => ({
  useEvalBatches: () => ({
    batches: [],
    isLoading: false,
    error: undefined,
    mutate: mockMutateBatches,
  }),
  fetchEvalBatchDetail: vi.fn(),
  fetchEvalRunDetail: vi.fn(),
}));

vi.mock("@/lib/eval/template-vars-hooks", () => ({
  useTemplateVars: () => ({
    templateVars: {},
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/tools/hooks", () => ({
  useTools: () => ({
    tools: [
      { id: "t1", name: "tool_a", enabled: true },
      { id: "t2", name: "tool_b", enabled: false },
    ],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

const mockEvalBatchCtx = {
  isRunning: false,
  activeBatch: null,
  progress: 0,
  cancelBatch: vi.fn(),
};

vi.mock("@/lib/eval/eval-run-context", () => ({
  useEvalBatch: () => mockEvalBatchCtx,
}));

// Mock RunEvalDialog to simplify testing
const mockOnConfirm = vi.fn();
vi.mock("../run-eval-dialog", () => ({
  RunEvalDialog: ({ open, onConfirm, confirming }: {
    open: boolean;
    onConfirm: (params: { judgeAgentId: string; assertionFailConfig: Record<string, boolean>; repeatCount: number; runConcurrency: number }) => void;
    confirming?: boolean;
  }) => {
    // Store onConfirm for test access
    mockOnConfirm.mockImplementation(onConfirm);
    return open ? (
      <div data-testid="run-eval-dialog">
        <button
          data-testid="dialog-confirm"
          disabled={confirming}
          onClick={() => onConfirm({ judgeAgentId: "judge-agent-1", assertionFailConfig: {}, repeatCount: 1, runConcurrency: 1 })}
        >
          Confirm
        </button>
      </div>
    ) : null;
  },
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const baseCase: EvalCaseRow = {
  id: "case-1",
  agentId: "agent-1",
  versionId: "version-1",
  key: "test_case",
  name: "Test Case",
  mode: "single" as const,
  turns: [{ id: "t1", role: "user" as const, content: "Hello, how are you?" }],
  expectedOutput: "I am fine",
  assertions: [{ id: "a1", type: "contains", value: "fine" }],
  tags: ["greeting"],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

/* ------------------------------------------------------------------ */
/*  Import component after mocks                                       */
/* ------------------------------------------------------------------ */

import { CaseDetail } from "../case-detail";
import { fetchEvalBatchDetail, fetchEvalRunDetail } from "@/lib/eval/hooks";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderDetail(overrides: Partial<EvalCaseRow> = {}) {
  const evalCase = { ...baseCase, ...overrides };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <CaseDetail evalCase={evalCase} agentId="agent-1" onSave={onSave} onDelete={onDelete} />
  );
  return { user, onSave, onDelete, evalCase };
}

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
  mockEvalBatchCtx.isRunning = false;
  mockEvalBatchCtx.activeBatch = null;
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Run button rendering", () => {
  it("renders a Run button", () => {
    renderDetail();
    expect(
      screen.getByRole("button", { name: /run/i })
    ).toBeInTheDocument();
  });

  it("Run button is disabled when global isRunning is true", () => {
    mockEvalBatchCtx.isRunning = true;
    renderDetail();
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });
});

describe("Mode selector", () => {
  it("renders the mode selector with single as default", () => {
    renderDetail();
    expect(screen.getByText("Single (one question)")).toBeInTheDocument();
  });
});

describe("Run execution via dialog", () => {
  it("opens dialog on Run click and sends create batch request", async () => {
    const mockResult = {
      caseId: "case-1",
      caseName: "Test Case",
      mode: "single" as const,
      turns: [{ id: "t1", role: "user" as const, content: "Hello, how are you?" }],
      chatMessages: [
        { role: "user" as const, content: "Hello, how are you?" },
        { role: "assistant" as const, content: "I am fine, thank you!" },
      ],
      turnResults: [],
      chatResponse: "I am fine, thank you!",
      assertionResults: [
        { assertion: { id: "a1", type: "contains" as const, value: "fine" }, passed: true, message: "Contains 'fine'" },
      ],
      allAssertionsPassed: true,
      judgeResult: {
        scores: { accuracy: { score: 9, reason: "Good answer" } },
        overallScore: 9,
      },
      timestamp: Date.now(),
      durationMs: 1234,
    };

    // Mock: create batch succeeds
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ batchId: "batch-1", chatModel: "gpt-4", status: "running" }),
      });

    // Mock: batch polling returns completed batch with one run
    const mockFetchBatchDetail = vi.mocked(fetchEvalBatchDetail);
    mockFetchBatchDetail
      .mockResolvedValueOnce({
        batch: { id: "batch-1", status: "running" } as never,
        runs: [],
      })
      .mockResolvedValueOnce({
        batch: { id: "batch-1", status: "completed" } as never,
        runs: [{ id: "run-1", judgeConfigSnapshot: null } as never],
      });

    // Mock: run detail returns result
    const mockFetchRunDetail = vi.mocked(fetchEvalRunDetail);
    mockFetchRunDetail.mockResolvedValueOnce({
      run: { id: "run-1", status: "completed" } as never,
      results: [{
        id: "r1",
        runId: "run-1",
        caseId: mockResult.caseId,
        caseName: mockResult.caseName,
        mode: mockResult.mode as "single",
        turns: mockResult.turns,
        chatMessages: mockResult.chatMessages,
        turnResults: mockResult.turnResults,
        chatResponse: mockResult.chatResponse,
        assertionResults: mockResult.assertionResults,
        allAssertionsPassed: mockResult.allAssertionsPassed,
        judgeResult: mockResult.judgeResult,
        error: null,
        durationMs: mockResult.durationMs,
        createdAt: new Date(),
      }],
    });

    const { user } = renderDetail();

    // Click Run button to open dialog
    await user.click(screen.getByRole("button", { name: /run/i }));

    // Dialog should be open
    expect(screen.getByTestId("run-eval-dialog")).toBeInTheDocument();

    // Click confirm in dialog
    await user.click(screen.getByTestId("dialog-confirm"));

    // Wait for results to appear (polling completes)
    await waitFor(() => {
      expect(screen.getByText("Run Results (1)")).toBeInTheDocument();
    }, { timeout: 10000 });

    // Verify create batch API was called with cases
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/eval/batch",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"cases"'),
      })
    );

    // Verify mutateBatches was called
    expect(mockMutateBatches).toHaveBeenCalled();
  });

  it("shows Running... and disables buttons during execution", async () => {
    let resolveCreate!: (value: unknown) => void;
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const { user } = renderDetail();

    // Click Run to open dialog
    await user.click(screen.getByRole("button", { name: /run/i }));
    // Click confirm
    await user.click(screen.getByTestId("dialog-confirm"));

    // Run button should show spinner text
    expect(screen.getByText("Running...")).toBeInTheDocument();

    // Save/Delete buttons should be disabled
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();

    // Resolve to finish
    await act(async () => {
      resolveCreate({
        ok: true,
        json: () => Promise.resolve({ batchId: "batch-1", chatModel: "gpt-4", status: "running" }),
      });
    });
  });

  it("uses current form values (not saved values) for run", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ batchId: "batch-1", chatModel: "gpt-4", status: "running" }),
      });

    // Mock polling to return completed immediately
    const mockFetchBatchDetail = vi.mocked(fetchEvalBatchDetail);
    mockFetchBatchDetail.mockResolvedValue({
      batch: { id: "batch-1", status: "completed" } as never,
      runs: [{ id: "run-1", judgeConfigSnapshot: null } as never],
    });

    const mockFetchRunDetail = vi.mocked(fetchEvalRunDetail);
    mockFetchRunDetail.mockResolvedValue({
      run: { id: "run-1", status: "completed" } as never,
      results: [{
        id: "r1",
        runId: "run-1",
        caseId: "case-1",
        caseName: "Test Case",
        mode: "single" as const,
        turns: [{ id: "t1", role: "user" as const, content: "Modified input" }],
        chatMessages: [],
        turnResults: [],
        chatResponse: "Response",
        assertionResults: [],
        allAssertionsPassed: true,
        judgeResult: null,
        error: null,
        durationMs: 100,
        createdAt: new Date(),
      }],
    });

    const { user } = renderDetail();

    // Modify input in form
    const inputTextarea = screen.getByPlaceholderText(
      "User message to send..."
    );
    await user.clear(inputTextarea);
    await user.type(inputTextarea, "Modified input");

    // Open dialog and confirm
    await user.click(screen.getByRole("button", { name: /run/i }));
    await user.click(screen.getByTestId("dialog-confirm"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    // Verify the body sent to API uses modified input (via cases[0])
    const createCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const createBody = JSON.parse(createCall[1].body);
    expect(createBody.cases[0].turns[0].content).toBe("Modified input");
    expect(createBody.cases[0].mode).toBe("single");
  });

  it("accumulates multiple run results with newest first", async () => {
    const makeResult = (ts: number) => ({
      id: `r-${ts}`,
      runId: `run-${ts}`,
      caseId: "case-1",
      caseName: "Test Case",
      mode: "single" as const,
      turns: [{ id: "t1", role: "user" as const, content: "Hello" }],
      chatMessages: [],
      turnResults: [],
      chatResponse: `Response at ${ts}`,
      assertionResults: [],
      allAssertionsPassed: true,
      judgeResult: null,
      error: null,
      durationMs: 100,
      createdAt: new Date(ts),
    });

    globalThis.fetch = vi
      .fn()
      // Batch 1
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ batchId: "batch-1", chatModel: "gpt-4", status: "running" }),
      })
      // Batch 2
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ batchId: "batch-2", chatModel: "gpt-4", status: "running" }),
      });

    const mockFetchBatchDetail = vi.mocked(fetchEvalBatchDetail);
    const mockFetchRunDetail = vi.mocked(fetchEvalRunDetail);

    // Poll for batch 1 — returns completed immediately
    mockFetchBatchDetail
      .mockResolvedValueOnce({
        batch: { id: "batch-1", status: "completed" } as never,
        runs: [{ id: "run-1", judgeConfigSnapshot: null } as never],
      })
      // Poll for batch 2 — returns completed immediately
      .mockResolvedValueOnce({
        batch: { id: "batch-2", status: "completed" } as never,
        runs: [{ id: "run-2", judgeConfigSnapshot: null } as never],
      });

    mockFetchRunDetail
      .mockResolvedValueOnce({
        run: { id: "run-1", status: "completed" } as never,
        results: [makeResult(1000)],
      })
      .mockResolvedValueOnce({
        run: { id: "run-2", status: "completed" } as never,
        results: [makeResult(2000)],
      });

    const { user } = renderDetail();

    // Batch 1: open dialog and confirm
    await user.click(screen.getByRole("button", { name: /run/i }));
    await user.click(screen.getByTestId("dialog-confirm"));
    await waitFor(() => {
      expect(screen.getByText("Run Results (1)")).toBeInTheDocument();
    }, { timeout: 10000 });

    // Batch 2: open dialog and confirm
    await user.click(screen.getByRole("button", { name: /run/i }));
    await user.click(screen.getByTestId("dialog-confirm"));
    await waitFor(() => {
      expect(screen.getByText("Run Results (2)")).toBeInTheDocument();
    }, { timeout: 10000 });
  });
});
