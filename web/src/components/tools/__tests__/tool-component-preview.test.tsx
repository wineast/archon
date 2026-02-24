// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Mock the DynamicComponentRenderer
vi.mock("@/tool-ui/_dynamic-renderer", () => ({
  DynamicComponentRenderer: vi.fn(({ tool, state }: { tool: { name: string; input: unknown; output: unknown }; state: string }) => (
    <div data-testid="dynamic-renderer" data-tool-name={tool.name} data-state={state}>
      rendered: {JSON.stringify(tool.output)}
    </div>
  )),
}));

// Mock the error boundary to pass through children normally
vi.mock("@/tool-ui/_error-boundary", () => ({
  DynamicComponentErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

import { ToolComponentPreview, type ToolComponentPreviewData } from "../tool-component-preview";
import type { ComponentType } from "react";
import type { ComponentRendererProps } from "@/tool-ui/_registry";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const FakeComponent = (() => null) as unknown as ComponentType<ComponentRendererProps>;

const preview: ToolComponentPreviewData = {
  compiledComponent: FakeComponent,
  generatedCss: ".my-class { color: blue; }",
};

const previewNoCss: ToolComponentPreviewData = {
  compiledComponent: FakeComponent,
  generatedCss: "",
};

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  document.head
    .querySelectorAll("style[data-tool-preview]")
    .forEach((el) => el.remove());
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("ToolComponentPreview", () => {
  it("renders the label and DynamicComponentRenderer", () => {
    render(
      <ToolComponentPreview
        toolName="my_tool"
        input={{ q: "test" }}
        output={{ result: "ok" }}
        preview={preview}
      />
    );

    expect(screen.getByText("Component Preview")).toBeInTheDocument();
    expect(screen.getByTestId("dynamic-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("dynamic-renderer")).toHaveAttribute("data-tool-name", "my_tool");
    expect(screen.getByTestId("dynamic-renderer")).toHaveAttribute("data-state", "output-available");
  });

  it("wraps renderer in error boundary", () => {
    render(
      <ToolComponentPreview
        toolName="my_tool"
        input={{}}
        output={{ a: 1 }}
        preview={preview}
      />
    );

    expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
  });

  it("injects generatedCss wrapped in @layer components", () => {
    render(
      <ToolComponentPreview
        toolName="my_tool"
        input={{}}
        output={{}}
        preview={preview}
      />
    );

    const style = document.querySelector("style[data-tool-preview]");
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain("@layer components");
    expect(style!.textContent).toContain(".my-class { color: blue; }");
  });

  it("does not inject style tag when generatedCss is empty", () => {
    render(
      <ToolComponentPreview
        toolName="my_tool"
        input={{}}
        output={{}}
        preview={previewNoCss}
      />
    );

    expect(document.querySelector("style[data-tool-preview]")).toBeNull();
  });
});
