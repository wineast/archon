import { config } from "dotenv";
config({ path: ".env.local" });
import { describe, it, expect } from "vitest";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { seed } from "../seed";
import {
  agents,
  chatConfigs,
  templateVars,
  evalJudgeConfigs,
  evalCases,
} from "../schema";

function createDb() {
  const client = neon(process.env.DATABASE_URL_UNPOOLED!);
  return drizzle({ client });
}

describe("seed idempotency", () => {
  it("should return identical IDs when run twice", async () => {
    const db = createDb();

    const result1 = await seed(db);
    const result2 = await seed(db);

    expect(result2.agentId).toBe(result1.agentId);
    expect(result2.toolIds).toEqual(result1.toolIds);
    expect(result2.modelConfigIds).toEqual(result1.modelConfigIds);
    expect(result2.chatConfigId).toBe(result1.chatConfigId);
    expect(result2.templateVarIds).toEqual(result1.templateVarIds);
    expect(result2.evalJudgeConfigId).toBe(result1.evalJudgeConfigId);
    expect(result2.evalCaseIds).toEqual(result1.evalCaseIds);
    expect(result2.lookupTableIds).toEqual(result1.lookupTableIds);
    expect(result2.dataObjectIds).toEqual(result1.dataObjectIds);
  }, 60_000);

  it("should not produce duplicate name rows", async () => {
    const db = createDb();

    await seed(db);
    await seed(db);

    // chatConfigs: check by agentId uniqueness (no name field)
    const chatConfigRows = await db
      .select({ agentId: chatConfigs.agentId, count: sql<number>`count(*)` })
      .from(chatConfigs)
      .groupBy(chatConfigs.agentId);

    for (const row of chatConfigRows) {
      expect(
        Number(row.count),
        `chatConfigs has duplicate agentId "${row.agentId}"`
      ).toBe(1);
    }

    const namedTables = [
      { table: evalJudgeConfigs, label: "evalJudgeConfigs" },
      { table: evalCases, label: "evalCases" },
    ] as const;

    for (const { table, label } of namedTables) {
      const rows = await db
        .select({ name: table.name, count: sql<number>`count(*)` })
        .from(table)
        .groupBy(table.name);

      for (const row of rows) {
        expect(
          Number(row.count),
          `${label} has duplicate name "${row.name}"`
        ).toBe(1);
      }
    }

    // templateVars: check by key instead of name
    const varRows = await db
      .select({ key: templateVars.key, count: sql<number>`count(*)` })
      .from(templateVars)
      .groupBy(templateVars.key);

    for (const row of varRows) {
      expect(
        Number(row.count),
        `templateVars has duplicate key "${row.key}"`
      ).toBe(1);
    }
  }, 120_000);
});
