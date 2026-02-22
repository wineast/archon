import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Resolve the editing version ID for an agent.
 * Throws if the agent has no editing version set.
 */
export async function resolveEditingVersionId(agentId: string): Promise<string> {
  const [agent] = await db
    .select({ editingVersionId: agents.editingVersionId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent?.editingVersionId) {
    throw new Error(`Agent ${agentId} has no editing version`);
  }

  return agent.editingVersionId;
}

/**
 * Resolve the published version ID for an agent.
 * Throws if the agent has no published version set.
 */
export async function resolvePublishedVersionId(agentId: string): Promise<string> {
  const [agent] = await db
    .select({ publishedVersionId: agents.publishedVersionId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent?.publishedVersionId) {
    throw new Error(`Agent ${agentId} has no published version`);
  }

  return agent.publishedVersionId;
}
