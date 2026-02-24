// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const FakeComponent = () => null;

vi.mock("@/lib/components/hooks", () => ({
  useComponents: vi.fn(),
}));

vi.mock("@/lib/components/use-compiled-component", () => ({
  useCompiledComponent: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

import { useToolComponentPreview } from "../use-tool-component-preview";
import { useComponents } from "@/lib/components/hooks";
import { useCompiledComponent } from "@/lib/components/use-compiled-component";

const mockUseComponents = vi.mocked(useComponents);
const mockUseCompiledComponent = vi.mocked(useCompiledComponent);

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const fakeComponents = [
  {
    id: "comp-1",
    key: "my-component",
    name: "My Component",
    componentSource: '<div>hello</div>',
    generatedCss: ".my-class { color: blue; }",
    description: "",
    agentId: "agent-1",
    versionId: "v-1",
    toolInputSchema: null,
    componentInputSchema: null,
    origin: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  {
    id: "comp-2",
    key: "other-component",
    name: "Other Component",
    componentSource: '<span>world</span>',
    generatedCss: "",
    description: "",
    agentId: "agent-1",
    versionId: "v-1",
    toolInputSchema: null,
    componentInputSchema: null,
    origin: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
];

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("useToolComponentPreview", () => {
  it("returns null when componentId is null", () => {
    mockUseComponents.mockReturnValue({
      components: fakeComponents as never[],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    mockUseCompiledComponent.mockReturnValue({
      compiledComponent: undefined,
      compositionDeps: undefined,
    });

    const { result } = renderHook(() =>
      useToolComponentPreview(null, "agent-1")
    );

    expect(result.current).toBeNull();
  });

  it("returns null when componentId does not match any component", () => {
    mockUseComponents.mockReturnValue({
      components: fakeComponents as never[],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    mockUseCompiledComponent.mockReturnValue({
      compiledComponent: undefined,
      compositionDeps: undefined,
    });

    const { result } = renderHook(() =>
      useToolComponentPreview("non-existent", "agent-1")
    );

    expect(result.current).toBeNull();
  });

  it("returns null when compilation fails (compiledComponent is undefined)", () => {
    mockUseComponents.mockReturnValue({
      components: fakeComponents as never[],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    mockUseCompiledComponent.mockReturnValue({
      compiledComponent: undefined,
      compositionDeps: undefined,
    });

    const { result } = renderHook(() =>
      useToolComponentPreview("comp-1", "agent-1")
    );

    expect(result.current).toBeNull();
  });

  it("returns preview data when component is found and compiled", () => {
    mockUseComponents.mockReturnValue({
      components: fakeComponents as never[],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    mockUseCompiledComponent.mockReturnValue({
      compiledComponent: FakeComponent as never,
      compositionDeps: undefined,
    });

    const { result } = renderHook(() =>
      useToolComponentPreview("comp-1", "agent-1")
    );

    expect(result.current).not.toBeNull();
    expect(result.current!.compiledComponent).toBe(FakeComponent);
    expect(result.current!.generatedCss).toBe(".my-class { color: blue; }");
  });

  it("passes correct args to useCompiledComponent", () => {
    mockUseComponents.mockReturnValue({
      components: fakeComponents as never[],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    mockUseCompiledComponent.mockReturnValue({
      compiledComponent: undefined,
      compositionDeps: undefined,
    });

    renderHook(() => useToolComponentPreview("comp-1", "agent-1"));

    expect(mockUseCompiledComponent).toHaveBeenCalledWith(
      "my-component",
      expect.arrayContaining([
        expect.objectContaining({ key: "my-component" }),
        expect.objectContaining({ key: "other-component" }),
      ]),
      "<div>hello</div>"
    );
  });

  it("returns null when agentId is undefined", () => {
    mockUseComponents.mockReturnValue({
      components: [],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    mockUseCompiledComponent.mockReturnValue({
      compiledComponent: undefined,
      compositionDeps: undefined,
    });

    const { result } = renderHook(() =>
      useToolComponentPreview("comp-1", undefined)
    );

    expect(result.current).toBeNull();
  });
});
