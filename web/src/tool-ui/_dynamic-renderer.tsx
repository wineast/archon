"use client";

import { memo, useMemo, type ComponentType } from "react";
import { transform } from "sucrase";
import { INJECTED_DEPS } from "./_allowed-components";
import type { ComponentRendererProps } from "./_registry";

// ── Compilation cache: source string → React component ──

const cache = new Map<string, ComponentType<ComponentRendererProps>>();

function compileSource(source: string): ComponentType<ComponentRendererProps> {
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
 *    return function({ data, state, ... }) {         // inner: render function
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
): ComponentType<ComponentRendererProps> {
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
  return outerFn(allDeps) as ComponentType<ComponentRendererProps>;
}

// ── Public renderer component ──

interface DynamicComponentRendererProps {
  data: unknown;
  state?: string;
  source?: string;
  /** Pre-compiled component (from compileComponentGraph). When provided, source is ignored. */
  compiledComponent?: ComponentType<ComponentRendererProps>;
}

export const DynamicComponentRenderer = memo(function DynamicComponentRenderer({
  data,
  state,
  source,
  compiledComponent,
}: DynamicComponentRendererProps) {
  const resolvedState = state ?? "output-available";
  const isLoading = resolvedState === "input-streaming" || resolvedState === "input-available";
  const isComplete = resolvedState === "output-available";
  const isError = resolvedState === "error";

  const Component = useMemo(
    () => compiledComponent ?? (source ? compileSource(source) : null),
    [compiledComponent, source]
  );

  if (!Component) return null;

  return (
    <Component
      data={data}
      state={resolvedState}
      isLoading={isLoading}
      isComplete={isComplete}
      isError={isError}
    />
  );
});
