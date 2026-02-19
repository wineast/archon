"use client";

import { memo, useMemo, type ComponentType } from "react";
import { transform } from "sucrase";
import { INJECTED_DEPS } from "./_allowed-components";
import type { ToolRendererProps } from "./_registry";

// ── Compilation cache: source string → React component ──

const cache = new Map<string, ComponentType<ToolRendererProps>>();

function compileSource(source: string): ComponentType<ToolRendererProps> {
  const cached = cache.get(source);
  if (cached) return cached;

  const Comp = compileSourceWithDeps(source);
  cache.set(source, Comp);
  return Comp;
}

/** Compile a component source with optional extra dependencies merged into INJECTED_DEPS.
 *  Does NOT use the source cache (intended for graph compilation). */
export function compileSourceWithDeps(
  source: string,
  extraDeps?: Record<string, unknown>
): ComponentType<ToolRendererProps> {
  const trimmed = source.trim();

  // Detect whether source is a full function component or a JSX fragment
  const isFullComponent = /^function\s+\w+/.test(trimmed);

  // Wrap into a module that returns a component
  const moduleCode = isFullComponent
    ? `${trimmed}\nreturn Component;`
    : `return function Component(props) {
  var tool = props.tool;
  var state = props.state;
  var isLoading = props.isLoading;
  var isComplete = props.isComplete;
  var isError = props.isError;
  return (${trimmed});
};`;

  // Compile JSX/TS → JS using sucrase
  const { code } = transform(moduleCode, {
    transforms: ["jsx", "typescript"],
    jsxRuntime: "classic",
    production: true,
  });

  // Merge injected deps with extra deps (e.g. composed components)
  const allDeps = extraDeps
    ? { ...INJECTED_DEPS, ...extraDeps }
    : INJECTED_DEPS;

  // Create factory function with injected dependencies
  const depNames = Object.keys(allDeps);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(...depNames, code);

  // Execute factory to get the component
  const depValues = Object.values(allDeps);
  return factory(...depValues) as ComponentType<ToolRendererProps>;
}

// ── Public renderer component ──

interface DynamicToolRendererProps {
  tool: { name: string; input: unknown; output: unknown };
  state: string;
  source?: string;
  /** Pre-compiled component (from compileComponentGraph). When provided, source is ignored. */
  compiledComponent?: ComponentType<ToolRendererProps>;
}

export const DynamicToolRenderer = memo(function DynamicToolRenderer({
  tool,
  state,
  source,
  compiledComponent,
}: DynamicToolRendererProps) {
  const isLoading = state === "input-streaming" || state === "input-available";
  const isComplete = state === "output-available";
  const isError = state === "error";

  const Component = useMemo(
    () => compiledComponent ?? (source ? compileSource(source) : null),
    [compiledComponent, source]
  );

  if (!Component) return null;

  return (
    <Component
      tool={tool}
      state={state}
      isLoading={isLoading}
      isComplete={isComplete}
      isError={isError}
    />
  );
});
