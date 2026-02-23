// @vitest-environment jsdom

// Polyfill pointer capture for Radix Select in jsdom
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}
// Polyfill scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockMutate = vi.fn();
const mockUpdateAgentSlotOverride = vi.fn().mockResolvedValue(true);
const mockDeleteAgentSlotOverride = vi.fn().mockResolvedValue(true);

let mockSlots: { slotKey: string; agentId: string | null; agentName: string; agentSlug: string; agentIcon: string }[] = [];
let mockAgents: { id: string; name: string }[] = [];

vi.mock("@/lib/slots/hooks", () => ({
  useAgentSlots: () => ({
    slots: mockSlots,
    isLoading: false,
    error: null,
    mutate: mockMutate,
  }),
  updateAgentSlotOverride: (...args: unknown[]) => mockUpdateAgentSlotOverride(...args),
  deleteAgentSlotOverride: (...args: unknown[]) => mockDeleteAgentSlotOverride(...args),
}));

vi.mock("@/lib/agents/hooks", () => ({
  useAgents: () => ({
    agents: mockAgents,
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

import { SlotAgentSelect } from "../slot-agent-select";

describe("SlotAgentSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSlots = [
      { slotKey: "builder", agentId: null, agentName: "", agentSlug: "", agentIcon: "" },
      { slotKey: "assist", agentId: null, agentName: "", agentSlug: "", agentIcon: "" },
      { slotKey: "evaluator", agentId: null, agentName: "", agentSlug: "", agentIcon: "" },
      { slotKey: "support", agentId: null, agentName: "", agentSlug: "", agentIcon: "" },
    ];
    mockAgents = [
      { id: "agent-a", name: "Agent A" },
      { id: "agent-b", name: "Agent B" },
    ];
  });

  it("renders with '未配置' when no agent is selected", () => {
    render(<SlotAgentSelect agentId="my-agent" orgId="org-1" slotKey="builder" />);
    expect(screen.getByText("未配置")).toBeInTheDocument();
  });

  it("renders with agent name when configured", () => {
    mockSlots[0] = {
      slotKey: "builder",
      agentId: "agent-a",
      agentName: "Agent A",
      agentSlug: "agent-a",
      agentIcon: "",
    };
    render(<SlotAgentSelect agentId="my-agent" orgId="org-1" slotKey="builder" />);
    expect(screen.getByText("Agent A")).toBeInTheDocument();
  });

  it("calls updateAgentSlotOverride when selecting an agent", async () => {
    const user = userEvent.setup();
    render(<SlotAgentSelect agentId="my-agent" orgId="org-1" slotKey="builder" />);

    // Open select
    await user.click(screen.getByRole("combobox"));
    // Select Agent A
    await user.click(screen.getByText("Agent A"));

    expect(mockUpdateAgentSlotOverride).toHaveBeenCalledWith(
      "my-agent",
      "builder",
      "agent-a",
      mockMutate
    );
  });

  it("calls deleteAgentSlotOverride when selecting '未配置'", async () => {
    mockSlots[0] = {
      slotKey: "builder",
      agentId: "agent-a",
      agentName: "Agent A",
      agentSlug: "agent-a",
      agentIcon: "",
    };
    const user = userEvent.setup();
    render(<SlotAgentSelect agentId="my-agent" orgId="org-1" slotKey="builder" />);

    await user.click(screen.getByRole("combobox"));

    // Find and click the "未配置" option in the dropdown
    const options = screen.getAllByText("未配置");
    // The option in the dropdown (not the trigger)
    const dropdownOption = options.find(
      (el) => el.closest("[role='option']") !== null
    );
    if (dropdownOption) {
      await user.click(dropdownOption);
    }

    expect(mockDeleteAgentSlotOverride).toHaveBeenCalledWith(
      "my-agent",
      "builder",
      mockMutate
    );
  });

  it("calls onChanged callback after update", async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <SlotAgentSelect agentId="my-agent" orgId="org-1" slotKey="builder" onChanged={onChanged} />
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Agent B"));

    expect(onChanged).toHaveBeenCalled();
  });
});
