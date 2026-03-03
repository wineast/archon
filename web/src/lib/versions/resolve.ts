import { db } from "@/db";
import { agents, agentVersions } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Resolve the editing version ID for an agent.
 * Throws if the agent has no editing version set.
 * Accepts an optional transaction context for use within db.transaction().
 */
export async function resolveEditingVersionId(
  agentId: string,
  conn: Tx | typeof db = db,
): Promise<string> {
  const [agent] = await conn
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

/**
 * Resolve version ID based on mode.
 * - `"published"` → published version (returns `null` if not published)
 * - default → editing version (throws if missing)
 */
export async function resolveVersionByMode(
  agentId: string,
  mode: string | null
): Promise<string | null> {
  if (mode === "published") {
    const [agent] = await db
      .select({ publishedVersionId: agents.publishedVersionId })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);
    return agent?.publishedVersionId ?? null;
  }
  return resolveEditingVersionId(agentId);
}

/**
 * Validate that a versionId belongs to the given agent.
 * Checks both agentVersions table and agent's editing/published version IDs.
 */
export async function validateVersionBelongsToAgent(
  agentId: string,
  versionId: string
): Promise<boolean> {
  // Check agentVersions table
  const [version] = await db
    .select({ id: agentVersions.id })
    .from(agentVersions)
    .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.id, versionId)))
    .limit(1);

  if (version) return true;

  // Also check if it's the editing or published version (might not be in agentVersions yet)
  const [agent] = await db
    .select({
      editingVersionId: agents.editingVersionId,
      publishedVersionId: agents.publishedVersionId,
    })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (!agent) return false;
  return agent.editingVersionId === versionId || agent.publishedVersionId === versionId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a version by ref (version string like "1.0.0" or UUID).
 * Returns { id, version, changelog, createdAt } or null.
 */
export async function resolveVersionByRef(
  agentId: string,
  ref: string
): Promise<{ id: string; version: string; changelog: string; createdAt: Date } | null> {
  const isUuid = UUID_RE.test(ref);

  const [row] = await db
    .select({
      id: agentVersions.id,
      version: agentVersions.version,
      changelog: agentVersions.changelog,
      createdAt: agentVersions.createdAt,
    })
    .from(agentVersions)
    .where(
      and(
        eq(agentVersions.agentId, agentId),
        isUuid
          ? eq(agentVersions.id, ref)
          : eq(agentVersions.version, ref)
      )
    )
    .limit(1);

  return row ?? null;
}
