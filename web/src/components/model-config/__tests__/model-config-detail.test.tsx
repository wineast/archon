// @vitest-environment jsdom

// Polyfill ResizeObserver for Radix ScrollArea
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ModelConfigRow } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/tools/hooks", () => ({
  useTools: () => ({ tools: [], isLoading: false, error: undefined, mutate: vi.fn() }),
  TOOLS_API_KEY: "/api/tools",
}));

vi.mock("@/lib/eval/template-vars-hooks", () => ({
  useTemplateVars: () => ({ templateVars: {}, isLoading: false, error: undefined, mutate: vi.fn() }),
}));

vi.mock("swr", () => ({
  default: () => ({ data: [], error: undefined, isLoading: false }),
}));

vi.mock("@/lib/lookup-tables/hooks", () => ({
  useLookupTables: () => ({ tables: [], isLoading: false, error: undefined, mutate: vi.fn() }),
}));

vi.mock("@/components/ui/template-editor", () => ({
  TemplateEditor: ({ value, onChange, placeholder, className }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <textarea
      data-testid="template-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-preview">{children}</div>,
}));

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const baseConfig: ModelConfigRow = {
  id: "cfg-1",
  agentId: "agent-1",
  name: "Test Config",
  modelId: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  temperature: 0.7,
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/* ------------------------------------------------------------------ */
/*  Import component after mocks                                       */
/* ------------------------------------------------------------------ */

import { ModelConfigDetail } from "../model-config-detail";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderDetail(overrides: Partial<ModelConfigRow> = {}) {
  const config = { ...baseConfig, ...overrides };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onActivate = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(
    <ModelConfigDetail
      config={config}
      onSave={onSave}
      onDelete={onDelete}
      onActivate={onActivate}
    />
  );
  return { user, onSave, onDelete, onActivate, config };
}

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ rendered: "**rendered content**" }),
  });
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("ModelConfigDetail tabs", () => {
  it("renders Edit, Preview, and Split tabs", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /preview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /split/i })).toBeInTheDocument();
  });

  it("defaults to Edit tab", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: /edit/i })).toHaveAttribute("data-state", "active");
  });
});

describe("Split tab", () => {
  it("shows split layout with editor and Render button", async () => {
    const { user } = renderDetail();
    await user.click(screen.getByRole("tab", { name: /split/i }));

    expect(screen.getByRole("tab", { name: /split/i })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("button", { name: /render/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("template-editor").length).toBeGreaterThanOrEqual(1);
  });

  it("shows placeholder before rendering", async () => {
    const { user } = renderDetail();
    await user.click(screen.getByRole("tab", { name: /split/i }));

    expect(screen.getByText("Click Render to preview")).toBeInTheDocument();
  });

  it("does not auto-fetch on tab switch", async () => {
    const { user } = renderDetail();
    await user.click(screen.getByRole("tab", { name: /split/i }));

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetches and displays preview when Render is clicked", async () => {
    const { user } = renderDetail();
    await user.click(screen.getByRole("tab", { name: /split/i }));
    await user.click(screen.getByRole("button", { name: /render/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/template/preview",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("You are a helpful assistant."),
        })
      );
    });

    await waitFor(() => {
      const previews = screen.getAllByTestId("markdown-preview");
      expect(previews.some((el) => el.textContent === "**rendered content**")).toBe(true);
    });
  });

  it("disables Render button while loading", async () => {
    let resolvePreview!: (value: unknown) => void;
    globalThis.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolvePreview = resolve; })
    );

    const { user } = renderDetail();
    await user.click(screen.getByRole("tab", { name: /split/i }));
    await user.click(screen.getByRole("button", { name: /render/i }));

    expect(screen.getByRole("button", { name: /render/i })).toBeDisabled();

    await act(async () => {
      resolvePreview({
        json: () => Promise.resolve({ rendered: "loaded content" }),
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /render/i })).not.toBeDisabled();
    });

    await waitFor(() => {
      const previews = screen.getAllByTestId("markdown-preview");
      expect(previews.some((el) => el.textContent === "loaded content")).toBe(true);
    });
  });
});

describe("Preview tab", () => {
  it("fetches preview when Preview tab is clicked", async () => {
    const { user } = renderDetail();
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/template/preview",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});

describe("Tab switching", () => {
  it("can switch between all three tabs", async () => {
    const { user } = renderDetail();

    await user.click(screen.getByRole("tab", { name: /split/i }));
    expect(screen.getByRole("tab", { name: /split/i })).toHaveAttribute("data-state", "active");

    await user.click(screen.getByRole("tab", { name: /preview/i }));
    expect(screen.getByRole("tab", { name: /preview/i })).toHaveAttribute("data-state", "active");

    await user.click(screen.getByRole("tab", { name: /edit/i }));
    expect(screen.getByRole("tab", { name: /edit/i })).toHaveAttribute("data-state", "active");
  });

  it("split and preview use separate state", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        json: () => Promise.resolve({ rendered: `rendered-${callCount}` }),
      });
    });

    const { user } = renderDetail();

    // Render in split tab
    await user.click(screen.getByRole("tab", { name: /split/i }));
    await user.click(screen.getByRole("button", { name: /render/i }));

    await waitFor(() => {
      const previews = screen.getAllByTestId("markdown-preview");
      expect(previews.some((el) => el.textContent === "rendered-1")).toBe(true);
    });

    // Switch to preview tab (auto-fetches)
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      const previews = screen.getAllByTestId("markdown-preview");
      expect(previews.some((el) => el.textContent === "rendered-2")).toBe(true);
    });
  });
});
