import type { SchemaProperty } from "@/lib/schemas/types";
import type { SchemaWithIncludes } from "@/db/schema";

export interface ResolvedParameter extends SchemaProperty {
  _source?: string; // 'own' | schema name
}

/**
 * Recursively merge includes' fields with own fields.
 * Priority: own fields > later include > earlier include.
 * `seen` set detects circular references.
 */
export function resolveParameters(
  schema: Pick<SchemaWithIncludes, "id" | "name" | "parameters" | "includeSchemaIds">,
  allSchemasMap: Map<string, SchemaWithIncludes>,
  seen?: Set<string>
): ResolvedParameter[] {
  const visited = seen ?? new Set<string>();
  if (visited.has(schema.id)) return [];
  visited.add(schema.id);

  const merged = new Map<string, ResolvedParameter>();

  // 1. Process includes in order (later overrides earlier)
  for (const includeId of schema.includeSchemaIds) {
    const included = allSchemasMap.get(includeId);
    if (!included) continue;

    const resolved = resolveParameters(included, allSchemasMap, visited);
    for (const param of resolved) {
      merged.set(param.name, {
        ...param,
        // For direct own fields of the included schema, attribute to the schema name.
        // For transitive fields, keep their original source.
        _source: param._source === "own" ? included.name : param._source,
      });
    }
  }

  // 2. Own fields override everything (highest priority)
  for (const param of schema.parameters) {
    merged.set(param.name, { ...param, _source: "own" });
  }

  return Array.from(merged.values());
}

/**
 * DFS cycle detection: would adding `candidateIncludes` to `schemaId` create a cycle?
 */
export function detectCycle(
  schemaId: string,
  candidateIncludes: string[],
  allSchemasMap: Map<string, SchemaWithIncludes>
): boolean {
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (id === schemaId) return true;
    if (visited.has(id)) return false;
    visited.add(id);

    const schema = allSchemasMap.get(id);
    if (!schema) return false;

    for (const childId of schema.includeSchemaIds) {
      if (dfs(childId)) return true;
    }
    return false;
  }

  for (const cid of candidateIncludes) {
    if (cid === schemaId) return true;
    if (dfs(cid)) return true;
  }

  return false;
}

/**
 * Get all reachable schema IDs from a given schema (transitive includes).
 * Used for filtering dropdown options on the frontend.
 */
export function getReachableSchemaIds(
  schemaId: string,
  allSchemasMap: Map<string, SchemaWithIncludes>
): Set<string> {
  const reachable = new Set<string>();

  function dfs(id: string) {
    if (reachable.has(id)) return;
    reachable.add(id);
    const schema = allSchemasMap.get(id);
    if (!schema) return;
    for (const childId of schema.includeSchemaIds) {
      dfs(childId);
    }
  }

  dfs(schemaId);
  return reachable;
}
