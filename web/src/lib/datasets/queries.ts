import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq } from "drizzle-orm";
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

/**
 * Fetch all datasets for an agent.
 */
export async function getDatasets(agentId: string) {
  return db
    .select({
      key: datasets.key,
      name: datasets.name,
      layer: datasets.layer,
      data: datasets.data,
    })
    .from(datasets)
    .where(eq(datasets.agentId, agentId));
}

/**
 * Resolve datasets: layer 0 provides base values, layer 1 can reference layer 0.
 * Returns resolved variables and dataset entries (for enumRef resolution).
 */
export function resolveDatasets(
  rows: Array<{ key: string; layer: number; data: unknown }>
): {
  resolvedVars: Record<string, unknown>;
  datasetEntries: Record<string, Array<{ value: string }>>;
} {
  const layer0: Record<string, unknown> = {};
  const layer1: Array<{ key: string; data: unknown }> = [];

  for (const row of rows) {
    if (row.layer === 0) {
      layer0[row.key] = row.data;
    } else {
      layer1.push({ key: row.key, data: row.data });
    }
  }

  // Resolve layer 1 with layer 0 as context
  const resolved: Record<string, unknown> = { ...layer0 };
  for (const item of layer1) {
    if (
      typeof item.data === "object" &&
      item.data !== null &&
      !Array.isArray(item.data)
    ) {
      resolved[item.key] = renderObjectField(
        item.data as Record<string, unknown>,
        layer0
      );
    } else if (typeof item.data === "string") {
      resolved[item.key] = renderField(item.data, layer0);
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
