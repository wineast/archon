import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { Liquid } from "liquidjs";

// Shared Liquid instance for simple variable substitution (no custom tags).
const simpleLiquid = new Liquid({ jsTruthy: true });

/**
 * Render a LiquidJS expression in a string field.
 * Only does simple variable substitution; falls back to the original string on error.
 */
export function renderField(
  raw: string,
  vars: Record<string, unknown>
): string {
  try {
    return simpleLiquid.parseAndRenderSync(raw, vars);
  } catch {
    return raw;
  }
}

/**
 * Render LiquidJS expressions inside a JSON object.
 * Serialises to JSON string, runs LiquidJS, then parses back.
 */
export function renderObjectField(
  raw: Record<string, unknown>,
  vars: Record<string, unknown>
): Record<string, unknown> {
  try {
    return JSON.parse(renderField(JSON.stringify(raw), vars));
  } catch {
    return raw;
  }
}

// ── Liquid built-in / reserved variable names (never treated as dataset deps) ──

const LIQUID_BUILTINS = new Set([
  "forloop", "tablerowloop",
  "nil", "null", "true", "false", "blank", "empty",
  "now", "today",
]);

/**
 * Extract dataset keys that a given data value depends on via Liquid templates.
 * Scans JSON.stringify(data) for `{{ var }}`, `{{ var.prop }}`,
 * `{% for x in var %}`, `{% if var %}`, etc.
 * Only returns root keys present in `knownKeys`, excluding Liquid built-ins
 * and loop iteration variables.
 */
export function extractDeps(data: unknown, knownKeys: Set<string>): string[] {
  const text = typeof data === "string" ? data : JSON.stringify(data);

  // Collect iteration variable names (e.g. `{% for item in list %}` → "item")
  const iterVars = new Set<string>();
  const forRe = /\{%-?\s*for\s+(\w+)\s+in\s+/g;
  let m: RegExpExecArray | null;
  while ((m = forRe.exec(text)) !== null) {
    iterVars.add(m[1]);
  }

  const deps = new Set<string>();

  // Match {{ var }}, {{ var.prop }}, {{ var | filter }}
  const outputRe = /\{\{-?\s*(\w+)/g;
  while ((m = outputRe.exec(text)) !== null) {
    deps.add(m[1]);
  }

  // Match {% tag var %} — for, if, unless, elsif, assign, etc.
  const tagRe = /\{%-?\s*(?:for\s+\w+\s+in|if|unless|elsif|assign\s+\w+\s*=)\s+(\w+)/g;
  while ((m = tagRe.exec(text)) !== null) {
    deps.add(m[1]);
  }

  // Filter: only known dataset keys, excluding built-ins and iteration vars
  return [...deps].filter(
    (k) => knownKeys.has(k) && !LIQUID_BUILTINS.has(k) && !iterVars.has(k)
  );
}

/**
 * Topological sort of dataset records using Kahn's algorithm.
 * Returns records in dependency order (dependencies first).
 * Throws if a circular dependency is detected.
 */
export function topoSortDatasets(
  records: Array<{ key: string; data: unknown }>
): Array<{ key: string; data: unknown }> {
  const byKey = new Map(records.map((r) => [r.key, r]));
  const knownKeys = new Set(records.map((r) => r.key));

  // Build dependency graph
  const depsMap = new Map<string, string[]>();
  for (const r of records) {
    depsMap.set(r.key, extractDeps(r.data, knownKeys));
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

  const sorted: Array<{ key: string; data: unknown }> = [];
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
    throw new Error(
      `Circular dependency detected among datasets: ${remaining.join(", ")}`
    );
  }

  return sorted;
}

/**
 * Validate that a set of dataset rows has no circular dependencies.
 * Throws if a cycle is detected.
 */
export function validateNoCycle(
  allRows: Array<{ key: string; data: unknown }>
): void {
  topoSortDatasets(allRows);
}

/**
 * Fetch all datasets for an agent.
 */
export async function getDatasets(agentId: string) {
  return db
    .select({
      key: datasets.key,
      name: datasets.name,
      data: datasets.data,
    })
    .from(datasets)
    .where(and(eq(datasets.agentId, agentId), isNull(datasets.deletedAt)));
}

/**
 * Resolve datasets using dependency-graph-driven rendering.
 * Topologically sorts datasets and renders each with all previously resolved
 * datasets as context, supporting N-level deep references.
 */
export function resolveDatasets(
  rows: Array<{ key: string; data: unknown }>
): {
  resolvedVars: Record<string, unknown>;
  datasetEntries: Record<string, Array<{ value: string }>>;
} {
  const sorted = topoSortDatasets(rows);
  const resolved: Record<string, unknown> = {};

  for (const item of sorted) {
    if (
      typeof item.data === "object" &&
      item.data !== null &&
      !Array.isArray(item.data)
    ) {
      resolved[item.key] = renderObjectField(
        item.data as Record<string, unknown>,
        resolved
      );
    } else if (typeof item.data === "string") {
      resolved[item.key] = renderField(item.data, resolved);
    } else {
      resolved[item.key] = item.data;
    }
  }

  // Build entries for enumRef resolution
  // Array → direct values; Object with string values → Object.values();
  // Object with non-string values → Object.keys()
  const datasetEntries: Record<string, Array<{ value: string }>> = {};
  for (const [key, val] of Object.entries(resolved)) {
    if (Array.isArray(val)) {
      datasetEntries[key] = val.map((v) => ({ value: String(v) }));
    } else if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      const values = Object.values(obj);
      if (values.length > 0 && typeof values[0] === "string") {
        datasetEntries[key] = values.map((v) => ({ value: String(v) }));
      } else {
        datasetEntries[key] = Object.keys(obj).map((k) => ({ value: k }));
      }
    }
  }

  return { resolvedVars: resolved, datasetEntries };
}

/**
 * Fetch and resolve all datasets for an agent.
 */
export async function getResolvedDatasets(agentId: string) {
  const rows = await getDatasets(agentId);
  return resolveDatasets(rows);
}
