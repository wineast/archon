/**
 * Function compilation & caching layer.
 *
 * Compiles JS source code stored in the `functions` table into callable functions.
 * Dependencies are inferred from the `function fn(...)` parameter names:
 *   - Known base dep names (e.g. compileExpression) → injected from npm packages
 *   - Other param names matching a function key → injected from compiled functions
 * Compilation order is determined by topological sort of the inferred dependency graph.
 *
 * Execution uses QuickJS WASM sandbox for isolation — user code cannot access
 * Node.js APIs, filesystem, network, or process globals.
 */

import { compileExpression } from "filtrex";
import { buildInputSchema } from "@/lib/tools/schema-builder";
import type { ToolParameter } from "@/lib/tools/types";
import {
  createFunctionsSandbox,
  type FunctionsSandbox,
} from "./sandbox";

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
 * Resolve and compile a set of function records into a shared sandbox.
 * Returns a map of key → sync wrapper function, plus the sandbox for lifecycle management.
 */
export async function resolveAndCompileFunctions(
  rows: FunctionRecord[]
): Promise<{ fns: Map<string, unknown>; sandbox: FunctionsSandbox }> {
  const sorted = topoSort(rows);
  const knownKeys = new Set(rows.map((r) => r.key));

  const records = sorted.map((row) => {
    // All deps for this function: base deps + function deps
    const fnDeps = inferDeps(row.code, knownKeys);
    const allDeps = [...Object.keys(BASE_DEPS), ...fnDeps];
    return {
      key: row.key,
      code: row.code,
      depNames: allDeps,
    };
  });

  const sandbox = await createFunctionsSandbox(records, BASE_DEPS);

  // Build map of key → sync wrapper with Zod validation
  const fns = new Map<string, unknown>();
  for (const row of rows) {
    if (row.parameters && row.parameters.length > 0) {
      const schema = buildInputSchema(row.parameters);
      fns.set(row.key, function validatedFn(input: unknown) {
        const parsed = schema.parse(input);
        return sandbox.call(row.key, parsed);
      });
    } else {
      fns.set(row.key, function (input: unknown) {
        return sandbox.call(row.key, input);
      });
    }
  }

  return { fns, sandbox };
}

// ── Agent-scoped cache ──

interface CacheEntry {
  fns: Map<string, unknown>;
  sandbox: FunctionsSandbox;
}

const agentCache = new Map<string, CacheEntry>();

export function getCachedFunctions(agentId: string): Map<string, unknown> | undefined {
  return agentCache.get(agentId)?.fns;
}

export function setCachedFunctions(
  agentId: string,
  fns: Map<string, unknown>,
  sandbox: FunctionsSandbox
) {
  // Dispose previous sandbox if replacing
  const prev = agentCache.get(agentId);
  if (prev) {
    prev.sandbox.dispose();
  }
  agentCache.set(agentId, { fns, sandbox });
}

export function clearFunctionCache(agentId?: string) {
  if (agentId) {
    const entry = agentCache.get(agentId);
    if (entry) {
      entry.sandbox.dispose();
      agentCache.delete(agentId);
    }
  } else {
    for (const entry of agentCache.values()) {
      entry.sandbox.dispose();
    }
    agentCache.clear();
  }
}
