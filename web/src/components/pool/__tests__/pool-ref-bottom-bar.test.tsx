// @vitest-environment jsdom

// Polyfill ResizeObserver for Radix ScrollArea
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockRemoveAgentRef = vi.fn().mockResolvedValue(undefined);
const mockToggleAgentRef = vi.fn().mockResolvedValue(undefined);
const mockMutateRefs = vi.fn();

vi.mock("@/lib/pool/ref-hooks", () => ({
  removeAgentRef: (...args: unknown[]) => mockRemoveAgentRef(...args),
  toggleAgentRef: (...args: unknown[]) => mockToggleAgentRef(...args),
  useAgentRefs: () => ({ refs: [], mutate: mockMutateRefs }),
}));

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

import { PoolRefBottomBar } from "../pool-ref-bottom-bar";

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
  mockRemoveAgentRef.mockResolvedValue(undefined);
  mockToggleAgentRef.mockResolvedValue(undefined);
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("PoolRefBottomBar", () => {
  it("renders remove button", () => {
    render(
      <PoolRefBottomBar
        agentId="agent-1"
        refId="ref-1"
        resourceType="function"
        onRemoved={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /移除引用/i })).toBeInTheDocument();
  });

  it("does NOT show enabled switch for non-tool resources", () => {
    render(
      <PoolRefBottomBar
        agentId="agent-1"
        refId="ref-1"
        resourceType="function"
        onRemoved={vi.fn()}
      />
    );
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows enabled switch for tool resources", () => {
    render(
      <PoolRefBottomBar
        agentId="agent-1"
        refId="ref-1"
        resourceType="tool"
        enabled={true}
        onRemoved={vi.fn()}
      />
    );
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("shows Disabled label when enabled=false for tool", () => {
    render(
      <PoolRefBottomBar
        agentId="agent-1"
        refId="ref-1"
        resourceType="tool"
        enabled={false}
        onRemoved={vi.fn()}
      />
    );
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("calls removeAgentRef and onRemoved when confirm remove", async () => {
    const onRemoved = vi.fn();
    const user = userEvent.setup();
    render(
      <PoolRefBottomBar
        agentId="agent-1"
        refId="ref-1"
        resourceType="schema"
        onRemoved={onRemoved}
      />
    );

    // Click remove button to open confirm dialog
    await user.click(screen.getByRole("button", { name: /移除引用/i }));

    // Confirm dialog should appear — find the destructive button within the dialog
    const buttons = await screen.findAllByRole("button", { name: /移除/i });
    // The last "移除" button is the confirm one in the dialog
    const confirmBtn = buttons[buttons.length - 1];
    await user.click(confirmBtn);

    expect(mockRemoveAgentRef).toHaveBeenCalledWith("agent-1", "ref-1", mockMutateRefs);
    expect(onRemoved).toHaveBeenCalled();
  });
});
