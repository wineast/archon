import type { ComponentType } from "react";

export interface ToolRendererProps {
  tool: { name: string; input: unknown; output: unknown };
  state: string;
  isLoading?: boolean;
  isComplete?: boolean;
  isError?: boolean;
}

/* ── Dynamic JSX source registry ── */

const dynamicRegistry = new Map<string, string>();

export function registerDynamicToolSource(key: string, source: string) {
  dynamicRegistry.set(key, source);
}

export function getDynamicToolSource(
  key: string | undefined | null
): string | undefined {
  if (!key) return undefined;
  return dynamicRegistry.get(key);
}

/* ── Compiled component registry (for composition) ── */

const compiledRegistry = new Map<string, ComponentType<ToolRendererProps>>();

export function registerCompiledToolComponent(
  toolName: string,
  comp: ComponentType<ToolRendererProps>
) {
  compiledRegistry.set(toolName, comp);
}

export function getCompiledToolComponent(
  toolName: string | undefined | null
): ComponentType<ToolRendererProps> | undefined {
  if (!toolName) return undefined;
  return compiledRegistry.get(toolName);
}

export function clearCompiledRegistry() {
  compiledRegistry.clear();
}
