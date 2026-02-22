/**
 * Function compilation & caching layer.
 *
 * Compiles ES module source code stored in the `functions` table into callable functions.
 * Dependencies are inferred from `import ... from "archon:fn/<key>"` statements.
 * Base dependencies (e.g. compileExpression) are injected as globals.
 * Compilation order is determined by topological sort of the inferred dependency graph.
 *
 * Execution uses QuickJS WASM sandbox for isolation — user code cannot access
 * Node.js APIs, filesystem, network, or process globals.
 */

import { compileExpression } from "filtrex";
import { buildInputSchema, type BuildSchemaOptions } from "@/lib/tools/schema-builder";
import type { JsonSchema7 } from "@/lib/schemas/types";
import {
  createFunctionsSandbox,
  type FunctionsSandbox,
} from "./sandbox";
import { inferDepsFromImports } from "@/lib/modules/detect";

// Base dependencies available to all functions (npm packages)
const BASE_DEPS: Record<string, unknown> = {
  compileExpression,
};

/**
 * Extract function-level dependencies from ES module import statements.
 * Extracts from `import ... from "archon:fn/<key>"` statements.
 */
export function inferDeps(code: string, knownKeys: Set<string>): string[] {
  return inferDepsFromImports(code, knownKeys);
}

export interface FunctionRecord {
  key: string;
  code: string;
  parameters: JsonSchema7;
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
  rows: FunctionRecord[],
  defsMap?: Record<string, JsonSchema7>,
): Promise<{ fns: Map<string, unknown>; sandbox: FunctionsSandbox }> {
  const sorted = topoSort(rows);
  const knownKeys = new Set(rows.map((r) => r.key));

  const records = sorted.map((row) => ({
    key: row.key,
    code: row.code,
  }));

  const sandbox = await createFunctionsSandbox(records, BASE_DEPS);

  // Build map of key → sync wrapper with Zod validation
  const fns = new Map<string, unknown>();
  for (const row of rows) {
    if (row.parameters && row.parameters.properties && Object.keys(row.parameters.properties).length > 0) {
      const schema = buildInputSchema(row.parameters, undefined, defsMap ? { defsMap } : undefined);
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
