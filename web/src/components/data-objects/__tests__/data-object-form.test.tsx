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
import {
  render,
  screen,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataObjectForm } from "../data-object-form";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const defaultProps = {
  objectKey: "product_routes",
  name: "Product Routes",
  description: "Loan product routing rules",
  data: { greeting: "Hello {{company_name}}" } as Record<string, unknown>,
  agentId: "agent-1",
  onDraftRef: vi.fn(),
  onDirtyChange: vi.fn(),
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderForm(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  const user = userEvent.setup();
  render(<DataObjectForm {...props} />);
  return { user, props };
}

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks();
  cleanup();
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () =>
      Promise.resolve({
        rendered: JSON.stringify({ greeting: "Hello ACME Corp" }, null, 2),
      }),
  });
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("DataObjectForm Edit/Preview tabs", () => {
  it("renders Edit and Preview tabs", () => {
    renderForm();
    expect(screen.getByRole("tab", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /preview/i })).toBeInTheDocument();
  });

  it("defaults to Edit tab", () => {
    renderForm();
    expect(screen.getByRole("tab", { name: /edit/i })).toHaveAttribute(
      "data-state",
      "active"
    );
  });

  it("shows textarea in Edit tab", () => {
    renderForm();
    const textarea = screen.getByPlaceholderText("{}");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue(JSON.stringify(defaultProps.data, null, 2));
  });
});

describe("Preview tab", () => {
  it("fetches preview when Preview tab is clicked", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/template/preview",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("company_name"),
        })
      );
    });
  });

  it("sends agentId in the preview request", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/template/preview",
        expect.objectContaining({
          body: expect.stringContaining('"agentId":"agent-1"'),
        })
      );
    });
  });

  it("displays rendered content in pre format", async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      const pre = screen.getByText(/Hello ACME Corp/);
      expect(pre.closest("pre")).toBeInTheDocument();
    });
  });

  it("shows spinner while loading", async () => {
    let resolvePreview!: (value: unknown) => void;
    globalThis.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolvePreview = resolve; })
    );

    const { user } = renderForm();
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    // Spinner should be visible during loading
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      resolvePreview({
        json: () =>
          Promise.resolve({
            rendered: JSON.stringify({ greeting: "Hello ACME Corp" }, null, 2),
          }),
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("shows empty message when data is empty", async () => {
    const { user } = renderForm({ data: {} });

    // Clear the textarea first
    const textarea = screen.getByPlaceholderText("{}");
    await user.clear(textarea);

    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      expect(screen.getByText("No content to preview")).toBeInTheDocument();
    });
  });
});

describe("Tab switching", () => {
  it("can switch back to Edit from Preview", async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole("tab", { name: /preview/i }));
    expect(screen.getByRole("tab", { name: /preview/i })).toHaveAttribute(
      "data-state",
      "active"
    );

    await user.click(screen.getByRole("tab", { name: /edit/i }));
    expect(screen.getByRole("tab", { name: /edit/i })).toHaveAttribute(
      "data-state",
      "active"
    );

    // Textarea should still be available with original data
    const textarea = screen.getByPlaceholderText("{}");
    expect(textarea).toHaveValue(JSON.stringify(defaultProps.data, null, 2));
  });

  it("re-fetches preview with updated data on tab switch", async () => {
    const { user } = renderForm();

    // Edit the data
    const textarea = screen.getByPlaceholderText("{}");
    await user.clear(textarea);
    await user.type(textarea, '{{"updated": true}}');

    // Switch to preview
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/template/preview",
        expect.objectContaining({
          body: expect.stringContaining("updated"),
        })
      );
    });
  });

  it("falls back to raw data when fetch fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { user } = renderForm();
    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      const pre = screen.getByText(/company_name/);
      expect(pre.closest("pre")).toBeInTheDocument();
    });
  });
});
