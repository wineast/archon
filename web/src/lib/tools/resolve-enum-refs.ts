import { db } from "@/db";
import { lookupTables, lookupEntries } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { ToolParameter } from "./types";

/**
 * Resolve enumRef references in tool parameters by looking up
 * lookup table entries and populating the enum array.
 *
 * Performs at most 2 SQL queries regardless of how many enumRefs exist.
 */
export async function resolveEnumRefs(
  parameters: ToolParameter[]
): Promise<void> {
  // Collect unique enumRef keys
  const refKeys = [
    ...new Set(
      parameters.filter((p) => p.enumRef && !p.enum?.length).map((p) => p.enumRef!)
    ),
  ];
  if (refKeys.length === 0) return;

  // Query 1: Get lookup table IDs by key
  const tables = await db
    .select({ id: lookupTables.id, key: lookupTables.key })
    .from(lookupTables)
    .where(inArray(lookupTables.key, refKeys));

  if (tables.length === 0) return;

  const keyToTableId = new Map(tables.map((t) => [t.key, t.id]));
  const tableIds = tables.map((t) => t.id);

  // Query 2: Get all entries for matched tables
  const entries = await db
    .select({
      tableId: lookupEntries.tableId,
      value: lookupEntries.value,
      order: lookupEntries.order,
    })
    .from(lookupEntries)
    .where(inArray(lookupEntries.tableId, tableIds))
    .orderBy(lookupEntries.order);

  // Group entries by tableId
  const tableIdToValues = new Map<string, string[]>();
  for (const entry of entries) {
    const arr = tableIdToValues.get(entry.tableId) ?? [];
    arr.push(entry.value);
    tableIdToValues.set(entry.tableId, arr);
  }

  // Fill enum arrays on parameters
  for (const param of parameters) {
    if (!param.enumRef || param.enum?.length) continue;
    const tableId = keyToTableId.get(param.enumRef);
    if (!tableId) continue;
    const values = tableIdToValues.get(tableId);
    if (values?.length) {
      param.enum = values;
    }
  }
}
