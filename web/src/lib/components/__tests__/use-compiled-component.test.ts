// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCompiledComponent } from "../use-compiled-component";

// Mock compileComponentGraph and keyToPascal from @/tool-ui
const mockCompileComponentGraph = vi.fn();
const mockKeyToPascal = vi.fn((key: string) =>
  key
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(""),
);

vi.mock("@/tool-ui", () => ({
  compileComponentGraph: (...args: unknown[]) =>
    mockCompileComponentGraph(...args),
  keyToPascal: (key: string) => mockKeyToPascal(key),
}));

describe("useCompiledComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined for both when componentKey is undefined", () => {
    const { result } = renderHook(() =>
      useCompiledComponent(undefined, [], "const A = () => <div/>;"),
    );
    expect(result.current.compiledComponent).toBeUndefined();
    expect(result.current.compositionDeps).toBeUndefined();
    expect(mockCompileComponentGraph).not.toHaveBeenCalled();
  });

  it("returns undefined for both when allComponents is empty", () => {
    const { result } = renderHook(() =>
      useCompiledComponent("my-comp", [], "const A = () => <div/>;"),
    );
    expect(result.current.compiledComponent).toBeUndefined();
    expect(result.current.compositionDeps).toBeUndefined();
    expect(mockCompileComponentGraph).not.toHaveBeenCalled();
  });

  it("returns undefined for both when componentSource is empty", () => {
    const { result } = renderHook(() =>
      useCompiledComponent("my-comp", [{ key: "my-comp", source: "old" }], ""),
    );
    expect(result.current.compiledComponent).toBeUndefined();
    expect(result.current.compositionDeps).toBeUndefined();
    expect(mockCompileComponentGraph).not.toHaveBeenCalled();
  });

  it("returns compiledComponent for a single component (no deps)", () => {
    const fakeComp = () => null;
    mockCompileComponentGraph.mockReturnValue(
      new Map([["my-comp", fakeComp]]),
    );

    const { result } = renderHook(() =>
      useCompiledComponent(
        "my-comp",
        [{ key: "my-comp", source: "old source" }],
        "new source",
      ),
    );

    expect(result.current.compiledComponent).toBe(fakeComp);
    expect(result.current.compositionDeps).toBeUndefined();
    // Verify it passed the updated source
    expect(mockCompileComponentGraph).toHaveBeenCalledWith([
      { key: "my-comp", source: "new source" },
    ]);
  });

  it("returns compiledComponent and compositionDeps when siblings exist", () => {
    const mainComp = () => null;
    const siblingComp = () => null;
    mockCompileComponentGraph.mockReturnValue(
      new Map([
        ["my-comp", mainComp],
        ["child-widget", siblingComp],
      ]),
    );

    const { result } = renderHook(() =>
      useCompiledComponent(
        "my-comp",
        [
          { key: "my-comp", source: "old" },
          { key: "child-widget", source: "child src" },
        ],
        "new source",
      ),
    );

    expect(result.current.compiledComponent).toBe(mainComp);
    expect(result.current.compositionDeps).toEqual({
      ChildWidget: siblingComp,
    });
  });

  it("replaces only the current component's source, keeps others intact", () => {
    mockCompileComponentGraph.mockReturnValue(new Map([["a", () => null]]));

    renderHook(() =>
      useCompiledComponent(
        "a",
        [
          { key: "a", source: "old-a" },
          { key: "b", source: "src-b" },
        ],
        "new-a",
      ),
    );

    expect(mockCompileComponentGraph).toHaveBeenCalledWith([
      { key: "a", source: "new-a" },
      { key: "b", source: "src-b" },
    ]);
  });

  it("returns undefined for both when compileComponentGraph throws (e.g. circular dependency)", () => {
    mockCompileComponentGraph.mockImplementation(() => {
      throw new Error("Circular dependency detected among components: a, b");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useCompiledComponent(
        "a",
        [
          { key: "a", source: "src-a" },
          { key: "b", source: "src-b" },
        ],
        "src-a",
      ),
    );

    expect(result.current.compiledComponent).toBeUndefined();
    expect(result.current.compositionDeps).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[useCompiledComponent]",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("does not recompute when inputs are the same (memo stability)", () => {
    const fakeComp = () => null;
    mockCompileComponentGraph.mockReturnValue(
      new Map([["my-comp", fakeComp]]),
    );

    const allComponents = [{ key: "my-comp", source: "old" }];
    const { rerender } = renderHook(() =>
      useCompiledComponent("my-comp", allComponents, "new source"),
    );

    expect(mockCompileComponentGraph).toHaveBeenCalledTimes(1);

    // Re-render with same references
    rerender();
    expect(mockCompileComponentGraph).toHaveBeenCalledTimes(1);
  });
});
