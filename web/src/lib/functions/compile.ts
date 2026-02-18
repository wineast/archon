/**
 * Function compilation & caching layer.
 *
 * Compiles JS source code stored in the `functions` table into callable functions.
 * Dependencies are inferred from the `function fn(...)` parameter names:
 *   - Known base dep names (e.g. compileExpression) → injected from npm packages
 *   - Other param names matching a function key → injected from compiled functions
 * Compilation order is determined by topological sort of the inferred dependency graph.
 */

import { compileExpression } from "filtrex";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import type { ToolParameter } from "@/lib/tools/types";

// Base dependencies available to all functions (npm packages)
const BASE_DEPS: Record<string, unknown> = {
  compileExpression,
};

const BASE_DEP_NAMES = new Set(Object.keys(BASE_DEPS));

/**
 * Parse parameter names from `function fn(param1, param2, ...)` in source code.
 */
export function parseFnParams(code: string): string[] {
  const match = code.match(/function\s+fn\s*\(([^)]*)\)/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Extract function-level dependencies from code (params minus base deps).
 */
export function inferDeps(code: string, knownKeys: Set<string>): string[] {
  return parseFnParams(code).filter(
    (p) => !BASE_DEP_NAMES.has(p) && knownKeys.has(p)
  );
}

/**
 * Compile a single function source into a callable.
 * When `parameters` is provided (non-empty), the returned function is wrapped
 * to validate its input against a Zod schema built from the parameters.
 */
export function compileFn(
  code: string,
  extraDeps: Record<string, unknown> = {},
  parameters?: ToolParameter[]
): unknown {
  const allDepNames = [...Object.keys(BASE_DEPS), ...Object.keys(extraDeps)];
  const allDepValues = [...Object.values(BASE_DEPS), ...Object.values(extraDeps)];

  const factory = new Function(
    ...allDepNames,
    code + `\n; return fn(${allDepNames.join(", ")});`
  );

  const rawFn = factory(...allDepValues);

  // Wrap with Zod validation when parameters are defined
  if (parameters && parameters.length > 0 && typeof rawFn === "function") {
    const schema = buildInputSchema(parameters);
    return function validatedFn(input: unknown) {
      const parsed = schema.parse(input);
      return (rawFn as (input: unknown) => unknown)(parsed);
    };
  }

  return rawFn;
}

export interface FunctionRecord {
  key: string;
  code: string;
  parameters: ToolParameter[];
}

/**
 * Topological sort using Kahn's algorithm.
 * Dependencies are inferred from function parameter names.
 * Throws on circular dependencies.
 */
function topoSort(records: FunctionRecord[]): FunctionRecord[] {
  const byKey = new Map(records.map((r) => [r.key, r]));
  const knownKeys = new Set(records.map((r) => r.key));

  // Infer deps for each function
  const depsMap = new Map<string, string[]>();
  for (const r of records) {
    depsMap.set(r.key, inferDeps(r.code, knownKeys));
  }

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const r of records) {
    inDegree.set(r.key, 0);
    dependents.set(r.key, []);
  }

  for (const [key, deps] of depsMap) {
    inDegree.set(key, deps.length);
    for (const d of deps) {
      dependents.get(d)!.push(key);
    }
  }

  const queue: string[] = [];
  for (const [key, deg] of inDegree) {
    if (deg === 0) queue.push(key);
  }

  const sorted: FunctionRecord[] = [];
  while (queue.length > 0) {
    const key = queue.shift()!;
    sorted.push(byKey.get(key)!);
    for (const dep of dependents.get(key)!) {
      const newDeg = inDegree.get(dep)! - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  if (sorted.length !== records.length) {
    const remaining = records
      .filter((r) => !sorted.some((s) => s.key === r.key))
      .map((r) => r.key);
    throw new Error(`Circular dependency detected among functions: ${remaining.join(", ")}`);
  }

  return sorted;
}

/**
 * Resolve and compile a set of function records, respecting dependency order.
 * Returns a map of key → compiled function.
 */
export function resolveAndCompileFunctions(
  rows: FunctionRecord[]
): Map<string, unknown> {
  const sorted = topoSort(rows);
  const knownKeys = new Set(rows.map((r) => r.key));
  const compiled = new Map<string, unknown>();

  for (const row of sorted) {
    // Inject only the function deps this code actually references
    const deps = inferDeps(row.code, knownKeys);
    const extraDeps: Record<string, unknown> = {};
    for (const depKey of deps) {
      if (compiled.has(depKey)) {
        extraDeps[depKey] = compiled.get(depKey);
      }
    }

    const result = compileFn(row.code, extraDeps, row.parameters);
    compiled.set(row.key, result);
  }

  return compiled;
}

// ── Agent-scoped cache ──

const agentCache = new Map<string, Map<string, unknown>>();

export function getCachedFunctions(agentId: string): Map<string, unknown> | undefined {
  return agentCache.get(agentId);
}

export function setCachedFunctions(agentId: string, fns: Map<string, unknown>) {
  agentCache.set(agentId, fns);
}

export function clearFunctionCache(agentId?: string) {
  if (agentId) {
    agentCache.delete(agentId);
  } else {
    agentCache.clear();
  }
}
