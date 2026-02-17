import { db } from "@/db";
import { templateVars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseTemplateVarValue } from "./parse";

export { parseTemplateVarValue } from "./parse";

export async function getTemplateVars(
  agentId: string
): Promise<Record<string, unknown>> {
  const rows = await db
    .select({
      key: templateVars.key,
      value: templateVars.value,
      type: templateVars.type,
      isArray: templateVars.isArray,
    })
    .from(templateVars)
    .where(eq(templateVars.agentId, agentId));

  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = parseTemplateVarValue(row.value, row.type, row.isArray);
  }
  return result;
}
