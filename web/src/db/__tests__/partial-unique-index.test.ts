import { config } from "dotenv";
config({ path: ".env.development.local" });
config({ path: ".env.local" });
import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "../schema";
import {
  orgs,
  agents,
  agentVersions,
  tools,
  functions,
  skills,
  evalCases,
  modelConfigs,
} from "../schema";

/**
 * Integration test: verify partial unique indexes allow re-inserting a key
 * after soft-deleting the old row (deleted_at IS NOT NULL).
 *
 * Covers three categories:
 * 1. Pool resource table (functions) — pool_key_idx + version_id_key_idx
 * 2. Agent resource table (tools)    — version_id_key_idx + pool_key_idx
 * 3. Pure agent resource tables (skills, evalCases, modelConfigs)
 * 4. Agents table — (orgId, slug)
 */

const pgClient = postgres(
  (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)!
);

function createDb() {
  return drizzle({ client: pgClient, schema });
}

const db = createDb();

// Track IDs for cleanup
const cleanupIds = {
  agentIds: [] as string[],
  orgId: null as string | null,
};

afterAll(async () => {
  // Clean up in reverse dependency order
  for (const agentId of cleanupIds.agentIds) {
    await db.delete(agents).where(eq(agents.id, agentId));
  }
  if (cleanupIds.orgId) {
    await db.delete(orgs).where(eq(orgs.id, cleanupIds.orgId));
  }
  await pgClient.end();
});

// Helper: create test org
async function createTestOrg() {
  const [org] = await db
    .insert(orgs)
    .values({ name: "__test_pui__", slug: `__test_pui_${Date.now()}__` })
    .returning();
  cleanupIds.orgId = org.id;
  return org;
}

// Helper: create test agent + version
async function createTestAgent(orgId: string, slug: string) {
  const [agent] = await db
    .insert(agents)
    .values({ orgId, name: slug, slug })
    .returning();
  cleanupIds.agentIds.push(agent.id);

  const [version] = await db
    .insert(agentVersions)
    .values({ agentId: agent.id, version: "draft" })
    .returning();

  return { agent, version };
}

describe("partial unique index", () => {
  it("pool resource: soft-delete then re-insert same key", async () => {
    // Clean up any stale data from previous runs
    await db.delete(functions).where(eq(functions.key, "__test_pui_fn__"));

    // Insert pool function (agentId=NULL)
    const [row1] = await db
      .insert(functions)
      .values({ key: "__test_pui_fn__", name: "Test Fn", code: "return 1" })
      .returning();

    // Soft-delete it
    await db
      .update(functions)
      .set({ deletedAt: new Date() })
      .where(eq(functions.id, row1.id));

    // Insert another pool function with same key — should succeed
    const [row2] = await db
      .insert(functions)
      .values({ key: "__test_pui_fn__", name: "Test Fn v2", code: "return 2" })
      .returning();

    expect(row2.id).not.toBe(row1.id);
    expect(row2.key).toBe("__test_pui_fn__");

    // Cleanup
    await db.delete(functions).where(eq(functions.id, row1.id));
    await db.delete(functions).where(eq(functions.id, row2.id));
  }, 30_000);

  it("agent resource (version scope): soft-delete then re-insert same key", async () => {
    const org = await createTestOrg();
    const { agent, version } = await createTestAgent(org.id, "__test_pui_tool__");

    // Insert tool under version
    const [row1] = await db
      .insert(tools)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-tool",
        name: "My Tool",
        description: "desc",
      })
      .returning();

    // Soft-delete
    await db
      .update(tools)
      .set({ deletedAt: new Date() })
      .where(eq(tools.id, row1.id));

    // Re-insert same key under same version — should succeed
    const [row2] = await db
      .insert(tools)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-tool",
        name: "My Tool v2",
        description: "desc v2",
      })
      .returning();

    expect(row2.id).not.toBe(row1.id);
    expect(row2.key).toBe("my-tool");

    // Cleanup
    await db.delete(tools).where(eq(tools.id, row1.id));
    await db.delete(tools).where(eq(tools.id, row2.id));
  }, 30_000);

  it("pure agent resource tables: soft-delete then re-insert same key", async () => {
    const org = cleanupIds.orgId
      ? { id: cleanupIds.orgId }
      : await createTestOrg();
    const { agent, version } = await createTestAgent(
      org.id,
      `__test_pui_pure_${Date.now()}__`
    );

    // --- skills ---
    const [skill1] = await db
      .insert(skills)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-skill",
        name: "My Skill",
      })
      .returning();

    await db.update(skills).set({ deletedAt: new Date() }).where(eq(skills.id, skill1.id));

    const [skill2] = await db
      .insert(skills)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-skill",
        name: "My Skill v2",
      })
      .returning();

    expect(skill2.id).not.toBe(skill1.id);

    // --- evalCases ---
    const [ec1] = await db
      .insert(evalCases)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-case",
        name: "Case 1",
      })
      .returning();

    await db.update(evalCases).set({ deletedAt: new Date() }).where(eq(evalCases.id, ec1.id));

    const [ec2] = await db
      .insert(evalCases)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-case",
        name: "Case 2",
      })
      .returning();

    expect(ec2.id).not.toBe(ec1.id);

    // --- modelConfigs ---
    const [mc1] = await db
      .insert(modelConfigs)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-model",
        name: "Model 1",
      })
      .returning();

    await db.update(modelConfigs).set({ deletedAt: new Date() }).where(eq(modelConfigs.id, mc1.id));

    const [mc2] = await db
      .insert(modelConfigs)
      .values({
        agentId: agent.id,
        versionId: version.id,
        key: "my-model",
        name: "Model 2",
      })
      .returning();

    expect(mc2.id).not.toBe(mc1.id);
  }, 30_000);

  it("agents table: soft-delete then re-insert same slug", async () => {
    const org = cleanupIds.orgId
      ? { id: cleanupIds.orgId }
      : await createTestOrg();

    const slug = `__test_pui_slug_${Date.now()}__`;

    const [agent1] = await db
      .insert(agents)
      .values({ orgId: org.id, name: "Agent 1", slug })
      .returning();
    cleanupIds.agentIds.push(agent1.id);

    // Soft-delete
    await db
      .update(agents)
      .set({ deletedAt: new Date() })
      .where(eq(agents.id, agent1.id));

    // Re-insert same slug under same org — should succeed
    const [agent2] = await db
      .insert(agents)
      .values({ orgId: org.id, name: "Agent 2", slug })
      .returning();
    cleanupIds.agentIds.push(agent2.id);

    expect(agent2.id).not.toBe(agent1.id);
    expect(agent2.slug).toBe(slug);
  }, 30_000);

  it("active records still enforce uniqueness", async () => {
    // Clean up stale data
    await db.delete(functions).where(eq(functions.key, "__test_pui_dup__"));

    // Insert pool function
    const [row] = await db
      .insert(functions)
      .values({ key: "__test_pui_dup__", name: "Dup", code: "x" })
      .returning();

    // Insert another with same key — should fail (both are active)
    await expect(
      db
        .insert(functions)
        .values({ key: "__test_pui_dup__", name: "Dup 2", code: "y" })
    ).rejects.toThrow();

    // Cleanup
    await db.delete(functions).where(eq(functions.id, row.id));
  }, 30_000);
});
