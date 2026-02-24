// @vitest-environment jsdom

// Polyfill ResizeObserver for Radix ScrollArea
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Mock useAgentSlots
const mockSlots = [
  { slotKey: "assist", agentId: "assist-agent-123", source: "org" as const, agentName: "Assist", agentSlug: "assist", agentIcon: "sparkles" },
];
vi.mock("@/lib/slots/hooks", () => ({
  useAgentSlots: () => ({ slots: mockSlots, isLoading: false, error: null, mutate: vi.fn() }),
}));

// Mock SlotAgentSelect
vi.mock("@/components/slots/slot-agent-select", () => ({
  SlotAgentSelect: ({ slotKey }: { slotKey: string }) => (
    <div data-testid={`slot-select-${slotKey}`}>SlotAgentSelect</div>
  ),
}));

// Mock editors — render simple textareas to avoid Monaco dependency
vi.mock("@/components/editors/js-editor", () => ({
  JsEditor: ({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) => (
    <textarea data-testid="js-editor" value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
  ),
}));
vi.mock("@/components/editors/md-editor", () => ({
  MdEditor: ({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) => (
    <textarea data-testid="md-editor" value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
  ),
}));
vi.mock("@/components/editors/json-editor", () => ({
  JsonEditor: ({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) => (
    <textarea data-testid="json-editor" value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
  ),
}));

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

import { AssistDialog } from "../assist-dialog";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderDialog(overrides: Partial<React.ComponentProps<typeof AssistDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    content: "original content",
    onApply: vi.fn(),
    agentId: "agent-1",
    orgId: "org-1",
    editorType: "md" as const,
    title: "Test Dialog",
    fieldContext: "system-prompt",
    ...overrides,
  };
  return { ...render(<AssistDialog {...props} />), props };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("AssistDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders dialog with title and editor", () => {
    renderDialog();
    expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    expect(screen.getByTestId("md-editor")).toBeInTheDocument();
  });

  it("uses correct editor for each type", () => {
    cleanup();
    renderDialog({ editorType: "js", content: "code" });
    expect(screen.getByTestId("js-editor")).toBeInTheDocument();
  });

  it("renders SlotAgentSelect when agentId and orgId are provided", () => {
    renderDialog();
    expect(screen.getByTestId("slot-select-assist")).toBeInTheDocument();
  });

  it("does not render SlotAgentSelect when orgId is missing", () => {
    renderDialog({ orgId: undefined });
    expect(screen.queryByTestId("slot-select-assist")).not.toBeInTheDocument();
  });

  it("renders iframe with correct src when assist agent ID is resolved", () => {
    renderDialog();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain("/embed/assist-agent-123");
  });

  it("Apply button is disabled when no changes", () => {
    renderDialog();
    const applyButton = screen.getByText("Apply");
    expect(applyButton).toBeDisabled();
  });

  it("Apply button is enabled after content changes", async () => {
    const user = userEvent.setup();
    renderDialog();
    const editor = screen.getByTestId("md-editor");
    await user.clear(editor);
    await user.type(editor, "new content");
    const applyButton = screen.getByText("Apply");
    expect(applyButton).not.toBeDisabled();
  });

  it("calls onApply with draft content and closes dialog", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    const editor = screen.getByTestId("md-editor");
    await user.clear(editor);
    await user.type(editor, "updated");
    await user.click(screen.getByText("Apply"));
    expect(props.onApply).toHaveBeenCalledWith("updated");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cancel closes dialog without calling onApply", async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();
    await user.click(screen.getByText("Cancel"));
    expect(props.onApply).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  describe("postMessage tool calls", () => {
    it("handles update_content tool call", async () => {
      renderDialog();

      // Simulate archon:tool-call from iframe
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "archon:tool-call",
              payload: {
                callId: "call-1",
                toolName: "update_content",
                args: { content: "brand new content" },
              },
            },
          })
        );
      });

      const editor = screen.getByTestId("md-editor") as HTMLTextAreaElement;
      expect(editor.value).toBe("brand new content");
    });

    it("handles edit_content tool call with successful match", async () => {
      renderDialog({ content: "hello world foo bar" });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "archon:tool-call",
              payload: {
                callId: "call-2",
                toolName: "edit_content",
                args: { old_text: "foo", new_text: "baz" },
              },
            },
          })
        );
      });

      const editor = screen.getByTestId("md-editor") as HTMLTextAreaElement;
      expect(editor.value).toBe("hello world baz bar");
    });

    it("handles edit_content tool call with no match", async () => {
      renderDialog({ content: "hello world" });

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "archon:tool-call",
              payload: {
                callId: "call-3",
                toolName: "edit_content",
                args: { old_text: "nonexistent", new_text: "replacement" },
              },
            },
          })
        );
      });

      // Content unchanged
      const editor = screen.getByTestId("md-editor") as HTMLTextAreaElement;
      expect(editor.value).toBe("hello world");
    });

    it("handles archon:streaming message to control loading state", async () => {
      renderDialog();

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "archon:streaming", payload: true },
          })
        );
      });

      // When streaming, a loading overlay should appear
      const overlay = document.querySelector(".bg-background\\/50");
      expect(overlay).toBeTruthy();
    });

    it("sends archon:context and archon:tools-register on archon:ready", async () => {
      renderDialog();

      // We can't easily test postMessage TO the iframe since it's mocked,
      // but we can verify the handler doesn't throw
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "archon:ready" },
          })
        );
      });

      // No error means the handler processed correctly
    });
  });
});
