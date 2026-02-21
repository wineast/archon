import type { ComponentType } from "react";

export interface ComponentRendererProps {
  data: unknown;
  tool?: { name: string; input: unknown; output: unknown };
  state?: string;
  isLoading?: boolean;
  isComplete?: boolean;
  isError?: boolean;
}

/* ── Dynamic JSX source registry ── */

const dynamicRegistry = new Map<string, string>();

export function registerDynamicComponentSource(key: string, source: string) {
  dynamicRegistry.set(key, source);
}

export function getDynamicComponentSource(
  key: string | undefined | null
): string | undefined {
  if (!key) return undefined;
  return dynamicRegistry.get(key);
}

/* ── Compiled component registry (for composition) ── */

const compiledRegistry = new Map<string, ComponentType<ComponentRendererProps>>();

export function registerCompiledComponent(
  key: string,
  comp: ComponentType<ComponentRendererProps>
) {
  compiledRegistry.set(key, comp);
}

export function getCompiledComponent(
  key: string | undefined | null
): ComponentType<ComponentRendererProps> | undefined {
  if (!key) return undefined;
  return compiledRegistry.get(key);
}

export function clearCompiledRegistry() {
  compiledRegistry.clear();
}
