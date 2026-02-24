import { useMemo } from "react";
import type { ComponentType } from "react";
import {
  compileComponentGraph,
  keyToPascal,
  type ComponentRecord,
  type ComponentRendererProps,
} from "@/tool-ui";

interface UseCompiledComponentResult {
  /** Compiled component for client-side rendering (Playground / Examples / Test Case preview). */
  compiledComponent: ComponentType<ComponentRendererProps> | undefined;
  /** Other compiled components as PascalName→Component map for SSR test execution (`extraDeps`). */
  compositionDeps: Record<string, unknown> | undefined;
}

/**
 * Shared hook that compiles the full component graph once and extracts:
 * - `compiledComponent` — the target component (for `<DynamicComponentRenderer compiledComponent={...} />`)
 * - `compositionDeps` — sibling components keyed by PascalName (for `compileSourceWithDeps(source, extraDeps)`)
 */
export function useCompiledComponent(
  componentKey: string | undefined,
  allComponents: ComponentRecord[] | undefined,
  componentSource: string,
): UseCompiledComponentResult {
  return useMemo(() => {
    if (!componentKey || !allComponents?.length || !componentSource.trim()) {
      return { compiledComponent: undefined, compositionDeps: undefined };
    }
    try {
      // Replace current component's source with latest (unsaved) version
      const records = allComponents.map((r) =>
        r.key === componentKey ? { ...r, source: componentSource } : r,
      );
      const compiled = compileComponentGraph(records);

      const compiledComponent = compiled.get(componentKey);

      // Build compositionDeps: all other compiled components keyed by PascalName
      const deps: Record<string, unknown> = {};
      for (const [key, comp] of compiled) {
        if (key !== componentKey) {
          deps[keyToPascal(key)] = comp;
        }
      }
      const compositionDeps =
        Object.keys(deps).length > 0 ? deps : undefined;

      return { compiledComponent, compositionDeps };
    } catch (e) {
      console.error("[useCompiledComponent]", e);
      return { compiledComponent: undefined, compositionDeps: undefined };
    }
  }, [componentKey, allComponents, componentSource]);
}
