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

const mockMutateRuns = vi.fn();

vi.mock("@/lib/model-config/hooks", () => ({
  useActiveModelConfig: () => ({
    activeConfig: {
      id: "mc-1",
      name: "Test Model",
      modelId: "claude-sonnet-4-5-20250929",
    },
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/eval/hooks", () => ({
  useDefaultJudgeConfig: () => ({
    defaultConfig: {
      id: "jc-1",
      name: "Default Judge",
      model: "claude-sonnet-4-5-20250929",
      systemPrompt: "Judge prompt",
      temperature: 0,
      dimensions: [{ key: "accuracy", label: "Accuracy", weight: 1 }],
      isDefault: true,
    },
    configs: [],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
  useEvalRuns: () => ({
    runs: [],
    isLoading: false,
    error: undefined,
    mutate: mockMutateRuns,
  }),
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

const mockEvalRunCtx = {
  isRunning: false,
  runningCaseId: null,
  progress: 0,
  setRunning: vi.fn(),
  setRunningCaseId: vi.fn(),
  setProgress: vi.fn(),
};

vi.mock("@/lib/eval/eval-run-context", () => ({
  useEvalRun: () => mockEvalRunCtx,
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const baseCase: EvalCaseRow = {
  id: "case-1",
  agentId: "agent-1",
  key: "test_case",
  name: "Test Case",
  mode: "single" as const,
  turns: [{ id: "t1", role: "user" as const, content: "Hello, how are you?" }],
  expectedOutput: "I am fine",
  assertions: [{ id: "a1", type: "contains", value: "fine" }],
  tags: ["greeting"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

/* ------------------------------------------------------------------ */
/*  Import component after mocks                                       */
/* ------------------------------------------------------------------ */

import { CaseDetail } from "../case-detail";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderDetail(overrides: Partial<EvalCaseRow> = {}) {
  const evalCase = { ...baseCase, ...overrides };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <CaseDetail evalCase={evalCase} onSave={onSave} onDelete={onDelete} />
  );
  return { user, onSave, onDelete, evalCase };
}

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
  mockEvalRunCtx.isRunning = false;
  mockEvalRunCtx.runningCaseId = null;
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
    mockEvalRunCtx.isRunning = true;
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

describe("Run execution", () => {
  it("calls 3-step API and shows result on success", async () => {
    const mockResult = {
      caseId: "case-1",
      caseName: "Test Case",
      mode: "single",
      turns: [{ id: "t1", role: "user", content: "Hello, how are you?" }],
      chatMessages: [
        { role: "user", content: "Hello, how are you?" },
        { role: "assistant", content: "I am fine, thank you!" },
      ],
      turnResults: [],
      chatResponse: "I am fine, thank you!",
      assertionResults: [
        { assertion: { id: "a1", type: "contains", value: "fine" }, passed: true, message: "Contains 'fine'" },
      ],
      allAssertionsPassed: true,
      judgeResult: {
        scores: { accuracy: { score: 9, reason: "Good answer" } },
        overallScore: 9,
      },
      timestamp: Date.now(),
      durationMs: 1234,
    };

    globalThis.fetch = vi
      .fn()
      // Step 1: Create run
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runId: "run-1" }),
      })
      // Step 2: Execute case
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: mockResult }),
      })
      // Step 3: Finalize
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    const { user } = renderDetail();
    await user.click(screen.getByRole("button", { name: /run/i }));

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText("Run Results (1)")).toBeInTheDocument();
    });

    // Verify 3-step API was called
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    // Step 1: Create run
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/eval/run",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"totalCases":1'),
      })
    );

    // Step 2: Execute case
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/eval/run/run-1/case",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"toolNames":["tool_a"]'),
      })
    );

    // Step 3: Finalize
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      "/api/eval/run/run-1",
      expect.objectContaining({ method: "PATCH" })
    );

    // Verify mutateRuns was called
    expect(mockMutateRuns).toHaveBeenCalled();

    // Verify result card content
    expect(screen.getByText("Test Model")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /run/i }));

    // Run button should show spinner text
    expect(screen.getByText("Running...")).toBeInTheDocument();

    // Save/Delete buttons should be disabled
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();

    // Resolve to finish
    await act(async () => {
      resolveCreate({
        ok: true,
        json: () => Promise.resolve({ runId: "run-1" }),
      });
    });
  });

  it("shows error result when create run fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const { user } = renderDetail();
    await user.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(screen.getByText("Run Results (1)")).toBeInTheDocument();
    });

    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("uses current form values (not saved values) for run", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runId: "run-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: {
              caseId: "case-1",
              caseName: "Test Case",
              mode: "single",
              turns: [{ id: "t1", role: "user", content: "Modified input" }],
              chatMessages: [],
              turnResults: [],
              chatResponse: "Response",
              assertionResults: [],
              allAssertionsPassed: true,
              judgeResult: null,
              timestamp: Date.now(),
              durationMs: 100,
            },
          }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const { user } = renderDetail();

    // Modify input in form
    const inputTextarea = screen.getByPlaceholderText(
      "User message to send..."
    );
    await user.clear(inputTextarea);
    await user.type(inputTextarea, "Modified input");

    await user.click(screen.getByRole("button", { name: /run/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    // Verify the case body sent to API uses modified input (via turns)
    const step2Call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[1];
    const step2Body = JSON.parse(step2Call[1].body);
    expect(step2Body.case.turns[0].content).toBe("Modified input");
    expect(step2Body.case.mode).toBe("single");
  });

  it("accumulates multiple run results with newest first", async () => {
    const makeResult = (ts: number) => ({
      caseId: "case-1",
      caseName: "Test Case",
      mode: "single",
      turns: [{ id: "t1", role: "user", content: "Hello" }],
      chatMessages: [],
      turnResults: [],
      chatResponse: `Response at ${ts}`,
      assertionResults: [],
      allAssertionsPassed: true,
      judgeResult: null,
      timestamp: ts,
      durationMs: 100,
    });

    globalThis.fetch = vi
      .fn()
      // Run 1
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runId: "run-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: makeResult(1000) }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      // Run 2
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ runId: "run-2" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: makeResult(2000) }),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const { user } = renderDetail();

    // Run 1
    await user.click(screen.getByRole("button", { name: /run/i }));
    await waitFor(() => {
      expect(screen.getByText("Run Results (1)")).toBeInTheDocument();
    });

    // Run 2
    await user.click(screen.getByRole("button", { name: /run/i }));
    await waitFor(() => {
      expect(screen.getByText("Run Results (2)")).toBeInTheDocument();
    });
  });
});
