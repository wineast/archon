"use client";

import { memo, useMemo, type ComponentType } from "react";
import { transform } from "sucrase";
import { INJECTED_DEPS, INJECTED_DEPS_BY_MODULE } from "./_allowed-components";
import { isModuleFormat } from "@/lib/modules/detect";
import { transformImports } from "@/lib/modules/transform-imports";
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

/** Compile a component source into a React component.
 *
 *  Supports two formats:
 *
 *  **Legacy (two-layer closure)**:
 *  ```
 *  function Component({ React, useState, DepA }) {  // outer: destructure deps
 *    return function({ data, state, ... }) {         // inner: render function
 *      ...
 *    }
 *  }
 *  ```
 *
 *  **Module (ES6 imports)**:
 *  ```
 *  import { useState } from "archon:react";
 *  import { Badge } from "archon:ui";
 *  export default function({ tool, isLoading }) { ... }
 *  ```
 *
 *  Does NOT use the source cache (intended for graph compilation). */
export function compileSourceWithDeps(
  source: string,
  extraDeps?: Record<string, unknown>
): ComponentType<ComponentRendererProps> {
  if (isModuleFormat(source)) {
    return compileModuleSource(source, extraDeps);
  }
  return compileLegacySource(source, extraDeps);
}

/** Compile legacy two-layer closure format. */
function compileLegacySource(
  source: string,
  extraDeps?: Record<string, unknown>
): ComponentType<ComponentRendererProps> {
  const moduleCode = `${source.trim()}\nreturn Component;`;

  const { code } = transform(moduleCode, {
    transforms: ["jsx", "typescript"],
    jsxRuntime: "classic",
    production: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(code);
  const outerFn = factory();

  const allDeps = { ...INJECTED_DEPS, ...(extraDeps ?? {}) };
  return outerFn(allDeps) as ComponentType<ComponentRendererProps>;
}

/** Compile ES module format using import transformation. */
function compileModuleSource(
  source: string,
  extraDeps?: Record<string, unknown>
): ComponentType<ComponentRendererProps> {
  // Transform archon:* imports into __deps__ lookups
  const { code: transformedCode, modules } = transformImports(source);

  // Transpile JSX/TS → JS
  const { code } = transform(transformedCode, {
    transforms: ["jsx", "typescript"],
    jsxRuntime: "classic",
    production: true,
  });

  // Build the __deps__ object from referenced modules
  const depsObj: Record<string, Record<string, unknown>> = {};
  for (const mod of modules) {
    // Check platform-provided module maps first
    if (mod in INJECTED_DEPS_BY_MODULE) {
      depsObj[mod] = INJECTED_DEPS_BY_MODULE[mod];
    } else if (mod.startsWith("archon:component/")) {
      // Component deps are provided via extraDeps keyed by PascalCase name
      const key = mod.slice("archon:component/".length);
      const pascalName = key
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("");
      if (extraDeps && pascalName in extraDeps) {
        depsObj[mod] = { default: extraDeps[pascalName] };
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function("__deps__", code);
  return factory(depsObj) as ComponentType<ComponentRendererProps>;
}

// ── Public renderer component ──

interface DynamicComponentRendererProps {
  data?: unknown;
  tool?: { name: string; input: unknown; output: unknown };
  state?: string;
  source?: string;
  /** Pre-compiled component (from compileComponentGraph). When provided, source is ignored. */
  compiledComponent?: ComponentType<ComponentRendererProps>;
}

export const DynamicComponentRenderer = memo(function DynamicComponentRenderer({
  data,
  tool,
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
      tool={tool}
      state={resolvedState}
      isLoading={isLoading}
      isComplete={isComplete}
      isError={isError}
    />
  );
});
