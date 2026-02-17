import type { ComponentType } from "react";

export interface ToolRendererProps {
  toolName: string;
  state: string;
  input: unknown;
  output: unknown;
}

const registry = new Map<string, ComponentType<ToolRendererProps>>();

export function registerToolRenderer(
  name: string,
  component: ComponentType<ToolRendererProps>
) {
  registry.set(name, component);
}

export function getToolRenderer(
  name: string | undefined | null
): ComponentType<ToolRendererProps> | undefined {
  if (!name) return undefined;
  return registry.get(name);
}
