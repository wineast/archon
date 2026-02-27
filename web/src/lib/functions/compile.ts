/**
 * Function compilation & caching layer.
 *
 * Compiles ES module source code stored in the `functions` table into callable functions.
 * Dependencies are inferred from `import ... from "archon:fn/<key>"` statements.
 * Base dependencies (e.g. compileExpression) are injected as globals.
 * Compilation order is determined by topological sort of the inferred dependency graph.
 *
 * Execution uses direct `new Function()` with static code scanning for safety.
 */

import { compileExpression } from "filtrex";
import { buildInputSchema, type BuildSchemaOptions } from "@/lib/tools/schema-builder";
import type { JsonSchema7 } from "@/lib/schemas/types";
import {
  createFunctionsExec,
  type FunctionsExec,
} from "./exec";
import { inferDepsFromImports } from "@/lib/modules/detect";

/**
 * All base dependencies available to functions (npm packages).
 * Used by test endpoints that always want all deps available.
 */
export const ALL_BASE_DEPS: Record<string, unknown> = {
  compileExpression,
};

/**
 * Mapping: builtin function key → required dep keys from ALL_BASE_DEPS.
 * Used to build a filtered deps map based on enabled builtin function refs.
 */
const BUILTIN_DEP_KEYS: Record<string, string[]> = {
  compileExpression: ["compileExpression"],
};

/**
 * Build a filtered base deps map from enabled builtin function keys.
 * Only includes deps whose corresponding builtin function is enabled.
 */
export function buildBaseDeps(
  enabledBuiltinKeys: Set<string>,
): Record<string, unknown> {
  const deps: Record<string, unknown> = {};
  for (const [builtinKey, depKeys] of Object.entries(BUILTIN_DEP_KEYS)) {
    if (enabledBuiltinKeys.has(builtinKey)) {
      for (const dk of depKeys) {
        deps[dk] = ALL_BASE_DEPS[dk];
      }
    }
  }
  return deps;
}

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
 * Resolve and compile a set of function records into a shared exec context.
 * Returns a map of key → sync wrapper function, plus the exec context for lifecycle management.
 */
export async function resolveAndCompileFunctions(
  rows: FunctionRecord[],
  defsMap?: Record<string, JsonSchema7>,
  baseDeps?: Record<string, unknown>,
): Promise<{ fns: Map<string, unknown>; exec: FunctionsExec }> {
  const sorted = topoSort(rows);

  const records = sorted.map((row) => ({
    key: row.key,
    code: row.code,
  }));

  const exec = await createFunctionsExec(records, baseDeps ?? ALL_BASE_DEPS);

  // Build map of key → sync wrapper with Zod validation
  const fns = new Map<string, unknown>();
  for (const row of rows) {
    if (row.parameters && row.parameters.properties && Object.keys(row.parameters.properties).length > 0) {
      const schema = buildInputSchema(row.parameters, undefined, defsMap ? { defsMap } : undefined);
      fns.set(row.key, function validatedFn(input: unknown) {
        const parsed = schema.parse(input);
        return exec.call(row.key, parsed);
      });
    } else {
      fns.set(row.key, function (input: unknown) {
        return exec.call(row.key, input);
      });
    }
  }

  return { fns, exec };
}

// ── Version-scoped cache ──
// Key format: "agentId:versionId" for version-level isolation.

interface CacheEntry {
  fns: Map<string, unknown>;
  exec: FunctionsExec;
}

function cacheKey(agentId: string, versionId: string): string {
  return `${agentId}:${versionId}`;
}

const agentCache = new Map<string, CacheEntry>();

export function getCachedFunctions(agentId: string, versionId: string): Map<string, unknown> | undefined {
  return agentCache.get(cacheKey(agentId, versionId))?.fns;
}

export function setCachedFunctions(
  agentId: string,
  versionId: string,
  fns: Map<string, unknown>,
  exec: FunctionsExec
) {
  const key = cacheKey(agentId, versionId);
  // Dispose previous exec context if replacing
  const prev = agentCache.get(key);
  if (prev) {
    prev.exec.dispose();
  }
  agentCache.set(key, { fns, exec });
}

/**
 * Clear function cache.
 * - No args: clear all cache entries
 * - agentId only: clear all versions for that agent (prefix match)
 * - agentId + versionId: clear specific version only
 */
export function clearFunctionCache(agentId?: string, versionId?: string) {
  if (agentId && versionId) {
    // Clear specific version
    const key = cacheKey(agentId, versionId);
    const entry = agentCache.get(key);
    if (entry) {
      entry.exec.dispose();
      agentCache.delete(key);
    }
  } else if (agentId) {
    // Clear all versions for this agent (prefix match)
    const prefix = `${agentId}:`;
    for (const [key, entry] of agentCache) {
      if (key.startsWith(prefix)) {
        entry.exec.dispose();
        agentCache.delete(key);
      }
    }
  } else {
    // Clear everything
    for (const entry of agentCache.values()) {
      entry.exec.dispose();
    }
    agentCache.clear();
  }
}
