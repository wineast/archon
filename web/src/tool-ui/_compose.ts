import type { ComponentType } from "react";
import { compileSourceWithDeps } from "./_dynamic-renderer";
import { inferComponentDepsFromImports } from "@/lib/modules/detect";
import type { ComponentRendererProps } from "./_registry";

// ── Naming helpers ──

export function keyToPascal(key: string): string {
  return key
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

// ── Dependency inference ──

/**
 * Infer component dependencies from source code.
 * Extracts from `import ... from "archon:component/<key>"` statements.
 */
export function inferComponentDeps(
  source: string,
  knownKeys: Set<string>,
): string[] {
  return inferComponentDepsFromImports(source, knownKeys);
}

// ── Topological sort (Kahn's algorithm) ──

export interface ComponentRecord {
  key: string;
  source: string;
}

export function topoSortComponents(
  records: ComponentRecord[]
): ComponentRecord[] {
  const knownKeys = new Set(records.map((r) => r.key));
  const recordMap = new Map(records.map((r) => [r.key, r]));

  // Build adjacency: key -> deps (keys it depends on)
  const deps = new Map<string, string[]>();
  for (const r of records) {
    deps.set(r.key, inferComponentDeps(r.source, knownKeys));
  }

  // In-degree
  const inDegree = new Map<string, number>();
  for (const key of knownKeys) inDegree.set(key, 0);
  for (const [, d] of deps) {
    for (const dep of d) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  // Queue: nodes with 0 in-degree (no one depends on them... wait, reverse)
  // Actually Kahn's: in-degree counts how many nodes point TO this node.
  // We want to process leaves first (nodes with no dependencies).
  // Let's recompute: in-degree = number of dependencies a node has.
  // No — standard Kahn's for topological sort:
  //   edge from A -> B means "A must come before B" (A is dependency of B)
  //   in-degree of B = number of edges pointing to B = number of deps of B

  // Recompute correctly:
  const inDeg = new Map<string, number>();
  for (const key of knownKeys) inDeg.set(key, 0);
  for (const [key, d] of deps) {
    // key depends on each dep, so edge: dep -> key
    inDeg.set(key, d.length);
  }

  const queue: string[] = [];
  for (const [key, deg] of inDeg) {
    if (deg === 0) queue.push(key);
  }

  const sorted: ComponentRecord[] = [];
  while (queue.length > 0) {
    const key = queue.shift()!;
    sorted.push(recordMap.get(key)!);

    // For every node that depends on `key`, decrement in-degree
    for (const [other, d] of deps) {
      if (d.includes(key)) {
        const newDeg = (inDeg.get(other) ?? 1) - 1;
        inDeg.set(other, newDeg);
        if (newDeg === 0) queue.push(other);
      }
    }
  }

  if (sorted.length !== records.length) {
    const remaining = records
      .filter((r) => !sorted.find((s) => s.key === r.key))
      .map((r) => r.key);
    throw new Error(
      `Circular dependency detected among components: ${remaining.join(", ")}`
    );
  }

  return sorted;
}

// ── Compile component graph ──

export function compileComponentGraph(
  records: ComponentRecord[]
): Map<string, ComponentType<ComponentRendererProps>> {
  if (records.length === 0) return new Map();

  const sorted = topoSortComponents(records);
  const compiled = new Map<string, ComponentType<ComponentRendererProps>>();
  const knownKeys = new Set(records.map((r) => r.key));

  for (const r of sorted) {
    // Gather already-compiled dependencies as extraDeps
    const depKeys = inferComponentDeps(r.source, knownKeys);
    const extraDeps: Record<string, unknown> = {};
    for (const depKey of depKeys) {
      const comp = compiled.get(depKey);
      if (comp) {
        extraDeps[keyToPascal(depKey)] = comp;
      }
    }

    const comp = compileSourceWithDeps(r.source, extraDeps);
    compiled.set(r.key, comp);
  }

  return compiled;
}
