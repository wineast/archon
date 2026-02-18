export interface ToolRendererProps {
  toolName: string;
  state: string;
  input: unknown;
  output: unknown;
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
