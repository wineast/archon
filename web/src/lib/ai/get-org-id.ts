import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Look up the orgId for a given agentId.
 * Returns null if agentId is falsy or not found.
 */
export async function getOrgIdByAgentId(
  agentId: string | undefined | null
): Promise<string | null> {
  if (!agentId) return null;
  const [row] = await db
    .select({ orgId: agents.orgId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  return row?.orgId ?? null;
}
