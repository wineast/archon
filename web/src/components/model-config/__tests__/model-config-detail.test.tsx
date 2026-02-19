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
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ModelConfigRow } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/tools/hooks", () => ({
  useTools: () => ({ tools: [], isLoading: false, error: undefined, mutate: vi.fn() }),
  TOOLS_API_KEY: "/api/tools",
}));

vi.mock("@/lib/datasets/hooks", () => ({
  useDatasetVarsMap: () => ({ datasetVars: {} }),
  useDatasets: () => ({ datasets: [], isLoading: false, error: undefined, mutate: vi.fn() }),
}));

vi.mock("swr", () => ({
  default: () => ({ data: [], error: undefined, isLoading: false }),
}));

vi.mock("@/components/editors/md-editor", () => ({
  MdEditor: ({ value, onChange, placeholder, className }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <textarea
      data-testid="md-editor"
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
  key: "test_config",
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
  it("renders Edit and Preview tabs", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /preview/i })).toBeInTheDocument();
  });

  it("defaults to Edit tab", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: /edit/i })).toHaveAttribute("data-state", "active");
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

  it("displays rendered content in preview", async () => {
    const { user } = renderDetail();
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      const preview = screen.getByTestId("markdown-preview");
      expect(preview.textContent).toBe("**rendered content**");
    });
  });
});

describe("Tab switching", () => {
  it("can switch between Edit and Preview tabs", async () => {
    const { user } = renderDetail();

    await user.click(screen.getByRole("tab", { name: /preview/i }));
    expect(screen.getByRole("tab", { name: /preview/i })).toHaveAttribute("data-state", "active");

    await user.click(screen.getByRole("tab", { name: /edit/i }));
    expect(screen.getByRole("tab", { name: /edit/i })).toHaveAttribute("data-state", "active");
  });
});
