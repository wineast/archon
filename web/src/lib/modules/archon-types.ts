/**
 * Generate TypeScript declaration files (.d.ts) for `archon:*` virtual modules.
 *
 * Used by Monaco editor to provide autocomplete and type checking for
 * user-authored code that uses `import ... from "archon:*"` syntax.
 */

// ── Static declarations (platform-provided modules) ──

export const ARCHON_CONTEXT_DTS = `
declare module "archon:context" {
  export interface WikiDoc {
    meta: Record<string, unknown> | null;
    content: string;
  }

  export interface DataEntry {
    value: string;
    label: string | null;
    metadata: Record<string, unknown> | null;
  }

  export const wiki: {
    get(id: string): Promise<WikiDoc | null>;
    findByPrefix(prefix: string): Promise<Array<{ id: string; name: string; meta: Record<string, unknown> | null; content: string }>>;
    search(query: string): Promise<Array<{ id: string; name: string; meta: Record<string, unknown> | null; content: string }>>;
  };

  export const dataset: {
    get(key: string): Promise<unknown>;
    getEntries(key: string): Promise<DataEntry[]>;
  };

  export const fn: (key: string) => Promise<(...args: unknown[]) => unknown>;

  export const ontology: {
    types(): Promise<Array<{ key: string; name: string; description: string }>>;
    type(key: string): Promise<{
      key: string;
      name: string;
      description: string;
      properties: unknown[];
      relations: Array<{ key: string; name: string; targetTypeKey: string; relationType: string }>;
    } | null>;
    query(typeKey: string, filters?: Record<string, unknown>): Promise<Array<{ id: string; label: string; data: Record<string, unknown>; createdAt: Date }>>;
    get(typeKey: string, id: string): Promise<{
      id: string;
      label: string;
      data: Record<string, unknown>;
      links: Array<{ relationKey: string; direction: "outgoing" | "incoming"; instanceId: string; label: string }>;
    } | null>;
    create(typeKey: string, data: Record<string, unknown>): Promise<{ id: string; label: string }>;
    update(typeKey: string, id: string, data: Record<string, unknown>): Promise<{ id: string; label: string }>;
    delete(typeKey: string, id: string): Promise<{ ok: boolean }>;
    link(sourceId: string, relationKey: string, targetId: string, metadata?: Record<string, unknown>): Promise<{ id: string }>;
    unlink(sourceId: string, relationKey: string, targetId: string): Promise<{ ok: boolean }>;
    graph(typeKey: string, id: string, options?: { depth?: number }): Promise<{
      nodes: Array<{ id: string; typeKey: string; label: string; data: Record<string, unknown> }>;
      edges: Array<{ sourceId: string; targetId: string; relationKey: string }>;
    }>;
  };
}
`;

export const ARCHON_REACT_DTS = `
declare module "archon:react" {
  import React from "react";
  export default React;
  export const useState: typeof React.useState;
  export const useMemo: typeof React.useMemo;
  export const useCallback: typeof React.useCallback;
  export const useEffect: typeof React.useEffect;
  export const useRef: typeof React.useRef;
  export const Fragment: typeof React.Fragment;
}
`;

export const ARCHON_UI_DTS = `
declare module "archon:ui" {
  import { ComponentType, ReactNode } from "react";

  export const Badge: ComponentType<{ variant?: string; className?: string; children?: ReactNode }>;
  export const Spinner: ComponentType<{ className?: string }>;
  export const Table: ComponentType<{ className?: string; children?: ReactNode }>;
  export const TableBody: ComponentType<{ children?: ReactNode }>;
  export const TableCell: ComponentType<{ className?: string; colSpan?: number; children?: ReactNode }>;
  export const TableHead: ComponentType<{ className?: string; children?: ReactNode }>;
  export const TableHeader: ComponentType<{ children?: ReactNode }>;
  export const TableRow: ComponentType<{ className?: string; children?: ReactNode }>;
  export const Tooltip: ComponentType<{ children?: ReactNode }>;
  export const TooltipContent: ComponentType<{ children?: ReactNode }>;
  export const TooltipTrigger: ComponentType<{ asChild?: boolean; children?: ReactNode }>;
  export const CollapsibleSection: ComponentType<{ title: string; children?: ReactNode; defaultOpen?: boolean }>;
  export const ResultHeader: ComponentType<{ title: string; children?: ReactNode }>;
  export const ResultSection: ComponentType<{ children?: ReactNode }>;
}
`;

export const ARCHON_ICONS_DTS = `
declare module "archon:icons" {
  import { ComponentType, SVGAttributes } from "react";
  type IconProps = SVGAttributes<SVGSVGElement> & { size?: number | string; className?: string };
  export const ChevronRight: ComponentType<IconProps>;
  export const FileText: ComponentType<IconProps>;
}
`;

export const ARCHON_LIB_FILTREX_DTS = `
declare module "archon:lib/filtrex" {
  export function compileExpression(expression: string, options?: Record<string, unknown>): (data: Record<string, unknown>) => unknown;
}
`;

/** All static archon:* type declarations. */
export const STATIC_ARCHON_DECLARATIONS = [
  ARCHON_CONTEXT_DTS,
  ARCHON_REACT_DTS,
  ARCHON_UI_DTS,
  ARCHON_ICONS_DTS,
  ARCHON_LIB_FILTREX_DTS,
].join("\n");

// ── Dynamic declarations (per-agent) ──

/**
 * Generate type declarations for agent-specific functions.
 *
 * @param fnKeys - Keys of functions available in the agent
 * @returns TypeScript declaration string for all `archon:fn/<key>` modules
 */
export function generateFnDeclarations(fnKeys: string[]): string {
  return fnKeys
    .map(
      (key) => `
declare module "archon:fn/${key}" {
  const fn: (input: unknown) => unknown;
  export default fn;
}
`
    )
    .join("\n");
}

/**
 * Generate type declarations for agent-specific components.
 *
 * @param componentKeys - Keys of components available in the agent
 * @returns TypeScript declaration string for all `archon:component/<key>` modules
 */
export function generateComponentDeclarations(componentKeys: string[]): string {
  return componentKeys
    .map(
      (key) => `
declare module "archon:component/${key}" {
  import { ComponentType } from "react";
  interface ToolRendererProps {
    tool: { name: string; input: unknown; output: unknown };
    state: string;
    isLoading: boolean;
    isComplete: boolean;
    isError: boolean;
  }
  const Component: ComponentType<ToolRendererProps>;
  export default Component;
}
`
    )
    .join("\n");
}
