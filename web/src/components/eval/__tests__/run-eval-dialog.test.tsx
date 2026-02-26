// @vitest-environment jsdom

// Polyfill ResizeObserver for Radix ScrollArea/Dialog
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver =
  ResizeObserverMock as unknown as typeof ResizeObserver;

import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

let mockJudgeAgentId: string | null = "judge-agent-1";

vi.mock("@/lib/eval/use-resolved-evaluator", () => ({
  useResolvedEvaluator: () => ({
    evaluator: mockJudgeAgentId
      ? {
          judgeAgentId: mockJudgeAgentId,
          judgeAgentName: "Evaluator",
          judgeAgentSlug: "evaluator",
        }
      : null,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/agents/hooks", () => ({
  useAgentOrgId: () => "org-1",
  useAgents: () => ({
    agents: [{ id: "judge-agent-1", name: "My Judge" }],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/slots/hooks", () => ({
  useAgentSlots: () => ({
    slots: [{ slotKey: "evaluator", agentId: "judge-agent-1" }],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }),
  updateAgentSlot: vi.fn(),
  deleteAgentSlot: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Import component after mocks                                       */
/* ------------------------------------------------------------------ */

import { RunEvalDialog } from "../run-eval-dialog";

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  cleanup();
  mockJudgeAgentId = "judge-agent-1";
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("RunEvalDialog", () => {
  it("renders dialog with Judge Agent select and assertion switches", () => {
    render(
      <RunEvalDialog
        open={true}
        onOpenChange={vi.fn()}
        agentId="agent-1"
        mode="all"
        caseCount={5}
        onConfirm={vi.fn()}
      />
    );

    // Dialog title
    expect(screen.getByText("运行评估")).toBeInTheDocument();

    // Assertion switches
    expect(screen.getByText("断言失败仍执行评估")).toBeInTheDocument();
    expect(screen.getByText("单轮断言失败仍评估该轮")).toBeInTheDocument();
    expect(screen.getByText("单轮断言失败停止后续轮")).toBeInTheDocument();

    // Confirm button with count
    expect(screen.getByRole("button", { name: /Run All \(5\)/i })).toBeInTheDocument();
  });

  it("shows 'Run' button in single mode", () => {
    render(
      <RunEvalDialog
        open={true}
        onOpenChange={vi.fn()}
        agentId="agent-1"
        mode="single"
        caseCount={1}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /^Run$/i })).toBeInTheDocument();
  });

  it("disables confirm when no judge agent", () => {
    mockJudgeAgentId = null;

    render(
      <RunEvalDialog
        open={true}
        onOpenChange={vi.fn()}
        agentId="agent-1"
        mode="all"
        caseCount={5}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Run All/i })).toBeDisabled();
    expect(screen.getByText("请选择一个 Judge Agent")).toBeInTheDocument();
  });

  it("calls onConfirm with params when confirm is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <RunEvalDialog
        open={true}
        onOpenChange={vi.fn()}
        agentId="agent-1"
        mode="all"
        caseCount={5}
        onConfirm={onConfirm}
      />
    );

    await user.click(screen.getByRole("button", { name: /Run All/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      judgeAgentId: "judge-agent-1",
      assertionFailConfig: {},
      concurrency: 3,
      repeatCount: 1,
      runConcurrency: 1,
    });
  });

  it("does not render when open is false", () => {
    render(
      <RunEvalDialog
        open={false}
        onOpenChange={vi.fn()}
        agentId="agent-1"
        mode="all"
        caseCount={5}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByText("运行评估")).not.toBeInTheDocument();
  });
});
