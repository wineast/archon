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
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
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
  versionId: "version-1",
  key: "test_config",
  name: "Test Config",
  modelId: "claude-sonnet-4-5-20250929",
  systemPrompt: "You are a helpful assistant.",
  temperature: 0.3,
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
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

describe("Temperature control", () => {
  it("renders slider and number input with default value", () => {
    renderDetail();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue(0.3);
  });

  it("renders hint text", () => {
    renderDetail();
    expect(screen.getByText("0 = more precise, 2 = more creative")).toBeInTheDocument();
  });

  it("changing temperature input enables Save button", async () => {
    const { user } = renderDetail();
    const input = screen.getByRole("spinbutton");

    await user.clear(input);
    await user.type(input, "1.2");

    await waitFor(() => {
      expect(screen.getByTestId("btn-save")).toBeEnabled();
    });
  });

  it("save passes temperature to onSave", async () => {
    const { user, onSave } = renderDetail();
    const input = screen.getByRole("spinbutton");

    await user.clear(input);
    await user.type(input, "1.5");

    await waitFor(() => {
      expect(screen.getByTestId("btn-save")).toBeEnabled();
    });

    await user.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("cfg-1", expect.objectContaining({
        temperature: 1.5,
      }));
    });
  });

  it("clamps value exceeding max to 2", async () => {
    const { user } = renderDetail();
    const input = screen.getByRole("spinbutton");

    await user.clear(input);
    await user.type(input, "5");

    await waitFor(() => {
      expect(input).toHaveValue(2);
    });
  });

  it("clamps negative value to 0", () => {
    renderDetail();
    const input = screen.getByRole("spinbutton");

    // Use fireEvent.change to directly set a negative value (userEvent.type
    // doesn't reliably produce negative numbers in number inputs)
    fireEvent.change(input, { target: { value: "-1" } });

    expect(input).toHaveValue(0);
  });

  it("reset restores original temperature", async () => {
    const { user } = renderDetail();
    const input = screen.getByRole("spinbutton");

    // Change temperature
    await user.clear(input);
    await user.type(input, "1.8");

    await waitFor(() => {
      expect(screen.getByTestId("btn-save")).toBeEnabled();
    });

    // Click Reset
    await user.click(screen.getByRole("button", { name: /reset/i }));

    await waitFor(() => {
      expect(input).toHaveValue(0.3);
      expect(screen.getByTestId("btn-save")).toBeDisabled();
    });
  });

  it("full temperature adjustment journey", async () => {
    const { user, onSave } = renderDetail();
    const input = screen.getByRole("spinbutton");

    // Step 1: initial value
    expect(input).toHaveValue(0.3);
    expect(screen.getByTestId("btn-save")).toBeDisabled();

    // Step 2: modify temperature
    await user.clear(input);
    await user.type(input, "1.5");

    // Step 3: Save enabled
    await waitFor(() => {
      expect(screen.getByTestId("btn-save")).toBeEnabled();
    });

    // Step 4: Save
    await user.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("cfg-1", expect.objectContaining({
        temperature: 1.5,
      }));
    });
  });
});
