import { config } from "dotenv";
config({ path: ".env.development.local" });
config({ path: ".env.local" });
import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { seed } from "../seed";
import * as schema from "../schema";
import {
  models,
  users,
  orgs,
  orgMembers,
  orgSlots,
} from "../schema";

const pgClient = postgres(
  (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)!
);

function createDb() {
  return drizzle({ client: pgClient, schema });
}

afterAll(async () => {
  await pgClient.end();
});

describe("seed idempotency", () => {
  it("should not produce duplicates when run twice", async () => {
    const db = createDb();

    await seed(db);
    await seed(db);

    // Models: no duplicate modelId
    const modelRows = await db
      .select({ modelId: models.modelId, count: sql<number>`count(*)` })
      .from(models)
      .groupBy(models.modelId);
    for (const row of modelRows) {
      expect(Number(row.count), `models duplicate modelId "${row.modelId}"`).toBe(1);
    }

    // Users: no duplicate clerkId
    const userRows = await db
      .select({ clerkId: users.clerkId, count: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.clerkId);
    for (const row of userRows) {
      expect(Number(row.count), `users duplicate clerkId "${row.clerkId}"`).toBe(1);
    }

    // Each user has exactly one personal org
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
      const personalOrgs = await db
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .innerJoin(orgs, sql`${orgs.id} = ${orgMembers.orgId}`)
        .where(sql`${orgMembers.userId} = ${user.id} AND ${orgs.isPersonal} = true`);
      expect(personalOrgs.length, `user ${user.email} should have exactly 1 personal org`).toBe(1);
    }

    // Each personal org has 3 slot agents (builder, assist, evaluator)
    const personalOrgRows = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(sql`${orgs.isPersonal} = true`);
    for (const org of personalOrgRows) {
      const slots = await db
        .select()
        .from(orgSlots)
        .where(sql`${orgSlots.orgId} = ${org.id}`);
      expect(slots.length, `org ${org.id} should have 3 slot agents`).toBe(3);
    }

    // OrgSlots: no duplicate (orgId, slotKey)
    const slotRows = await db
      .select({
        orgId: orgSlots.orgId,
        slotKey: orgSlots.slotKey,
        count: sql<number>`count(*)`,
      })
      .from(orgSlots)
      .groupBy(orgSlots.orgId, orgSlots.slotKey);
    for (const row of slotRows) {
      expect(
        Number(row.count),
        `orgSlots duplicate (orgId, slotKey) "${row.orgId}:${row.slotKey}"`
      ).toBe(1);
    }
  }, 120_000);
});
