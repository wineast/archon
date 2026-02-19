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

/** Compile a two-layer closure component source.
 *
 *  Source format:
 *  ```
 *  function Component({ React, useState, DepA }) {  // outer: destructure deps
 *    return function({ tool, state, ... }) {         // inner: render function
 *      ...
 *    }
 *  }
 *  ```
 *
 *  Compilation:
 *  1. Sucrase transpile (JSX/TS → JS)
 *  2. `new Function(code + '\nreturn Component;')` → outer function
 *  3. `outer({ ...INJECTED_DEPS, ...extraDeps })` → inner render function
 *
 *  Does NOT use the source cache (intended for graph compilation). */
export function compileSourceWithDeps(
  source: string,
  extraDeps?: Record<string, unknown>
): ComponentType<ToolRendererProps> {
  const moduleCode = `${source.trim()}\nreturn Component;`;

  // Compile JSX/TS → JS using sucrase
  const { code } = transform(moduleCode, {
    transforms: ["jsx", "typescript"],
    jsxRuntime: "classic",
    production: true,
  });

  // Step 2: compile source into outer closure (no deps injected via new Function)
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(code);
  const outerFn = factory();

  // Step 3: call outer closure with all deps as a single object
  const allDeps = { ...INJECTED_DEPS, ...(extraDeps ?? {}) };
  return outerFn(allDeps) as ComponentType<ToolRendererProps>;
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
