// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestInspectorModal } from "../request-inspector-modal";
import type { UIMessage } from "ai";
import type { ToolRow } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Mock useTools                                                      */
/* ------------------------------------------------------------------ */

const mockTools: ToolRow[] = [];

vi.mock("@/lib/tools/hooks", () => ({
  useTools: () => ({ tools: mockTools, isLoading: false, error: undefined, mutate: vi.fn() }),
  TOOLS_API_KEY: "/api/tools",
}));

/* ------------------------------------------------------------------ */
/*  Test fixtures                                                      */
/* ------------------------------------------------------------------ */

const defaultModel = "openai/gpt-5.2";
const defaultSystemPrompt = "You are a helpful assistant.";
const defaultAgentId = "agent-1";

const emptyMessages: UIMessage[] = [];

const sampleMessages: UIMessage[] = [
  { id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
  {
    id: "m2",
    role: "assistant",
    parts: [{ type: "text", text: "Hi there!" }],
  },
] as UIMessage[];

const sampleToolRows: ToolRow[] = [
  {
    id: "t1",
    key: "get_weather",
    name: "get_weather",
    description: "Get the current weather",
    handler: null,
    url: null,
    componentId: null,
    parametersSchema: null,
    returnParametersSchema: null,
    enabled: true,
    uiHidden: false,
    executionTarget: "server",
    sandboxMode: "light",
    origin: "user",
    agentId: null,
    versionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: "t2",
    key: "search",
    name: "search",
    description: "Search the web",
    handler: null,
    url: null,
    componentId: null,
    parametersSchema: null,
    returnParametersSchema: null,
    enabled: true,
    uiHidden: false,
    executionTarget: "server",
    sandboxMode: "light",
    origin: "user",
    agentId: null,
    versionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

type ModalProps = {
  model?: string;
  systemPrompt?: string;
  messages?: UIMessage[];
  temperature?: number;
  agentId?: string;
};

/** Set up userEvent, render modal, open dialog, optionally switch tab. */
async function setup(props: ModalProps = {}, tabName?: RegExp) {
  const user = userEvent.setup();
  render(
    <RequestInspectorModal
      model={props.model ?? defaultModel}
      systemPrompt={props.systemPrompt ?? defaultSystemPrompt}
      messages={props.messages ?? emptyMessages}
      temperature={props.temperature ?? 0.7}
      agentId={props.agentId ?? defaultAgentId}
    />
  );
  await user.click(screen.getByRole("button", { name: /inspect/i }));
  if (tabName) {
    await user.click(screen.getByRole("tab", { name: tabName }));
  }
  return user;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("RequestInspectorModal", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    // Reset mock tools
    mockTools.length = 0;
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    // Default fetch mock for template preview
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ rendered: "Rendered prompt" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  /* ---------- Trigger button ---------- */

  describe("trigger button", () => {
    it("renders a button with 'Inspect' text", () => {
      render(
        <RequestInspectorModal
          model={defaultModel}
          systemPrompt={defaultSystemPrompt}
          messages={emptyMessages}
          temperature={0.7}
        />
      );
      expect(
        screen.getByRole("button", { name: /inspect/i })
      ).toBeInTheDocument();
    });

    it("opens the dialog when clicked", async () => {
      await setup();
      expect(
        screen.getByRole("heading", { name: /request inspector/i })
      ).toBeInTheDocument();
    });
  });

  /* ---------- Overview tab ---------- */

  describe("overview tab", () => {
    it("is shown by default when dialog opens", async () => {
      mockTools.push(...sampleToolRows);
      await setup({ messages: sampleMessages });
      expect(screen.getByText(defaultModel)).toBeInTheDocument();
    });

    it("displays model in a badge", async () => {
      await setup({ model: "anthropic/claude-4" });
      const badge = screen.getByText("anthropic/claude-4");
      expect(badge).toBeInTheDocument();
      expect(badge.closest("[data-slot='badge']")).not.toBeNull();
    });

    it("displays system prompt preview", async () => {
      await setup({ systemPrompt: "Custom system prompt" });
      expect(screen.getByText("Custom system prompt")).toBeInTheDocument();
    });

    it("displays correct message count with zero messages", async () => {
      await setup({ messages: [] });
      expect(screen.getByText("0 message(s)")).toBeInTheDocument();
    });

    it("displays correct message count with multiple messages", async () => {
      await setup({ messages: sampleMessages });
      expect(screen.getByText("2 message(s)")).toBeInTheDocument();
    });

    it("displays correct tool count with zero tools", async () => {
      await setup();
      expect(screen.getByText("0 tool(s) enabled")).toBeInTheDocument();
    });

    it("displays correct tool count with multiple tools", async () => {
      mockTools.push(...sampleToolRows);
      await setup();
      expect(screen.getByText("2 tool(s) enabled")).toBeInTheDocument();
    });
  });

  /* ---------- System tab ---------- */

  describe("system tab", () => {
    it("defaults to Rendered view and shows rendered content", async () => {
      await setup(
        { systemPrompt: "Hello {{company}}", agentId: "agent-1" },
        /^system$/i
      );

      // Should show Rendered button as active
      const renderedBtn = screen.getByRole("tab", { name: /^rendered$/i });
      expect(renderedBtn).toBeInTheDocument();

      // Wait for fetch to complete
      await waitFor(() => {
        const tabPanel = screen.getAllByRole("tabpanel")[0];
        const pre = tabPanel.querySelector("pre");
        expect(pre).not.toBeNull();
        expect(pre!.textContent).toBe("Rendered prompt");
      });
    });

    it("calls /api/template/preview with correct params", async () => {
      await setup(
        { systemPrompt: "Hello {{name}}", agentId: "agent-42" },
        /^system$/i
      );

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "/api/template/preview",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ text: "Hello {{name}}", agentId: "agent-42" }),
          })
        );
      });
    });

    it("switches to Template view and shows raw template", async () => {
      const user = await setup(
        { systemPrompt: "Hello {{company}}", agentId: "agent-1" },
        /^system$/i
      );

      // Wait for rendered content to load first
      await waitFor(() => {
        expect(screen.getAllByRole("tabpanel")[0].querySelector("pre")).not.toBeNull();
      });

      // Switch to Template view
      await user.click(screen.getByRole("tab", { name: /^template$/i }));

      const tabPanel = screen.getAllByRole("tabpanel")[0];
      const pre = tabPanel.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre!.textContent).toBe("Hello {{company}}");
    });

    it("switches back to Rendered view from Template", async () => {
      const user = await setup(
        { systemPrompt: "Hello {{company}}", agentId: "agent-1" },
        /^system$/i
      );

      // Wait for rendered content
      await waitFor(() => {
        const pre = screen.getAllByRole("tabpanel")[0].querySelector("pre");
        expect(pre?.textContent).toBe("Rendered prompt");
      });

      // Switch to Template
      await user.click(screen.getByRole("tab", { name: /^template$/i }));
      expect(screen.getAllByRole("tabpanel")[0].querySelector("pre")!.textContent).toBe(
        "Hello {{company}}"
      );

      // Switch back to Rendered — should use cached result, no extra fetch
      await user.click(screen.getByRole("tab", { name: /^rendered$/i }));
      expect(screen.getAllByRole("tabpanel")[0].querySelector("pre")!.textContent).toBe(
        "Rendered prompt"
      );
    });

    it("shows Spinner while loading rendered content", async () => {
      // Make fetch hang indefinitely
      vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));

      await setup(
        { systemPrompt: "Hello {{x}}", agentId: "agent-1" },
        /^system$/i
      );

      // Should show spinner (Spinner renders LoaderIcon svg)
      const tabPanel = screen.getAllByRole("tabpanel")[0];
      expect(tabPanel.querySelector("svg")).toBeInTheDocument();
      // No pre tag while loading
      expect(tabPanel.querySelector("pre")).toBeNull();
    });

    it("does not show toggle when agentId is not provided", async () => {
      const user = userEvent.setup();
      render(
        <RequestInspectorModal
          model={defaultModel}
          systemPrompt="No agent"
          messages={emptyMessages}
          temperature={0.7}
        />
      );
      await user.click(screen.getByRole("button", { name: /inspect/i }));
      await user.click(screen.getByRole("tab", { name: /^system$/i }));

      expect(screen.queryByRole("tab", { name: /^rendered$/i })).toBeNull();
      expect(screen.queryByRole("tab", { name: /^template$/i })).toBeNull();

      // Should show raw prompt
      const tabPanel = screen.getAllByRole("tabpanel")[0];
      const pre = tabPanel.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre!.textContent).toBe("No agent");
    });

    it("has a copy button", async () => {
      await setup({}, /^system$/i);
      expect(
        screen.getByRole("button", { name: /copy/i })
      ).toBeInTheDocument();
    });

    it("copy button works in rendered view (shows Copied)", async () => {
      const user = await setup(
        { systemPrompt: "Hello {{company}}", agentId: "agent-1" },
        /^system$/i
      );

      // Wait for rendered content to load
      await waitFor(() => {
        const pre = screen.getAllByRole("tabpanel")[0].querySelector("pre");
        expect(pre?.textContent).toBe("Rendered prompt");
      });

      await user.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /copied/i })
        ).toBeInTheDocument();
      });
    });

    it("copy button works in template view (shows Copied)", async () => {
      const user = await setup(
        { systemPrompt: "Hello {{company}}", agentId: "agent-1" },
        /^system$/i
      );

      // Wait for rendered load
      await waitFor(() => {
        expect(screen.getAllByRole("tabpanel")[0].querySelector("pre")).not.toBeNull();
      });

      // Switch to template — verify template content is shown
      await user.click(screen.getByRole("tab", { name: /^template$/i }));
      expect(
        screen.getAllByRole("tabpanel")[0].querySelector("pre")!.textContent
      ).toBe("Hello {{company}}");

      await user.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /copied/i })
        ).toBeInTheDocument();
      });
    });
  });

  /* ---------- Messages tab ---------- */

  describe("messages tab", () => {
    it("displays JSON-formatted messages in a <pre> tag", async () => {
      await setup({ messages: sampleMessages }, /messages/i);

      const expected = JSON.stringify(sampleMessages, null, 2);
      const tabPanel = screen.getAllByRole("tabpanel")[0];
      const pre = tabPanel.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre!.textContent).toBe(expected);
    });

    it("displays empty array for zero messages", async () => {
      await setup({ messages: [] }, /messages/i);
      expect(screen.getByText("[]", { selector: "pre" })).toBeInTheDocument();
    });

    it("has a copy button", async () => {
      await setup({}, /messages/i);
      expect(
        screen.getByRole("button", { name: /copy/i })
      ).toBeInTheDocument();
    });
  });

  /* ---------- Tools tab ---------- */

  describe("tools tab", () => {
    it("displays JSON-formatted tools in a <pre> tag", async () => {
      mockTools.push(...sampleToolRows);
      await setup({}, /^tools$/i);

      const tabPanel = screen.getAllByRole("tabpanel")[0];
      const pre = tabPanel.querySelector("pre");
      expect(pre).not.toBeNull();
      // tools are filtered (enabled) and mapped to payload shape
      const expected = sampleToolRows.map(({ name, description, handler, url }) => ({
        name,
        description,
        handler: handler ?? "",
        url: url ?? "",
      }));
      expect(pre!.textContent).toBe(JSON.stringify(expected, null, 2));
    });

    it("displays empty array for zero tools", async () => {
      await setup({}, /^tools$/i);
      expect(screen.getByText("[]", { selector: "pre" })).toBeInTheDocument();
    });

    it("has a copy button", async () => {
      await setup({}, /^tools$/i);
      expect(
        screen.getByRole("button", { name: /copy/i })
      ).toBeInTheDocument();
    });
  });

  /* ---------- Tab navigation ---------- */

  describe("tab navigation", () => {
    it("renders all four tab triggers", async () => {
      await setup();

      const tabs = screen.getAllByRole("tab");
      const tabNames = tabs.map((t) => t.textContent);
      expect(tabNames).toEqual(
        expect.arrayContaining(["Overview", "System", "Messages", "Tools"])
      );
    });

    it("switches from overview to system tab", async () => {
      const user = await setup({ systemPrompt: "Test system prompt" });

      // Start on overview
      expect(screen.getByText("0 message(s)")).toBeInTheDocument();

      // Switch to system tab
      await user.click(screen.getByRole("tab", { name: /^system$/i }));

      // Wait for rendered content
      await waitFor(() => {
        const pre = screen.getAllByRole("tabpanel")[0].querySelector("pre");
        expect(pre).not.toBeNull();
      });
    });
  });

  /* ---------- Copy button ---------- */

  describe("copy button", () => {
    it("shows 'Copied' after clicking copy on system tab", async () => {
      const user = await setup(
        { systemPrompt: "Copy this prompt" },
        /^system$/i
      );

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getAllByRole("tabpanel")[0].querySelector("pre")).not.toBeNull();
      });

      await user.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /copied/i })
        ).toBeInTheDocument();
      });
    });

    it("shows 'Copied' after clicking copy on messages tab", async () => {
      const user = await setup({ messages: sampleMessages }, /messages/i);
      await user.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /copied/i })
        ).toBeInTheDocument();
      });
    });

    it("shows 'Copied' after clicking copy on tools tab", async () => {
      mockTools.push(...sampleToolRows);
      const user = await setup({}, /^tools$/i);
      await user.click(screen.getByRole("button", { name: /copy/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /copied/i })
        ).toBeInTheDocument();
      });
    });
  });

  /* ---------- Props reactivity ---------- */

  describe("props reactivity", () => {
    it("reflects updated props when re-rendered", async () => {
      mockTools.push(...sampleToolRows);
      const user = userEvent.setup();
      const { rerender } = render(
        <RequestInspectorModal
          model="openai/gpt-5.2"
          systemPrompt="Initial prompt"
          messages={emptyMessages}
          temperature={0.7}
          agentId={defaultAgentId}
        />
      );

      await user.click(screen.getByRole("button", { name: /inspect/i }));
      expect(screen.getByText("openai/gpt-5.2")).toBeInTheDocument();
      expect(screen.getByText("0 message(s)")).toBeInTheDocument();

      // Re-render with new props
      rerender(
        <RequestInspectorModal
          model="anthropic/claude-4"
          systemPrompt="Updated prompt"
          messages={sampleMessages}
          temperature={0.5}
          agentId={defaultAgentId}
        />
      );

      expect(screen.getByText("anthropic/claude-4")).toBeInTheDocument();
      expect(screen.getByText("2 message(s)")).toBeInTheDocument();
      expect(screen.getByText("2 tool(s) enabled")).toBeInTheDocument();
    });
  });
});
