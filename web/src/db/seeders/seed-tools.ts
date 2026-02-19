import { join } from "path";
import { eq } from "drizzle-orm";
import { tools, schemas, toolTestCases } from "../schema";
import { readJson, toKey, logSection, log } from "../seed-utils";
import type { SchemaProperty } from "@/lib/schemas/types";
import type { Seeder } from "./types";

export const seedTools: Seeder = {
  name: "tools",
  async run(ctx) {
    const { agentId } = ctx;

    // ── Tool parameter schemas ──
    logSection("Seeding tool parameter schemas");

    const toolsSeed = readJson<
      Array<{
        key?: string;
        name: string;
        description: string;
        parameters: SchemaProperty[];
        handler?: string;
        enabled: boolean;
        component?: string;
      }>
    >(join(ctx.agentDir, "tools.json"));

    const schemaIdMap: Record<string, string> = {};
    for (const t of toolsSeed) {
      if (t.parameters.length === 0) continue;
      const toolKey = t.key ?? toKey(t.name);
      const schemaKey = `${toolKey}_params`;
      const schemaName = `${t.name} Parameters`;

      const [schemaRow] = await ctx.db
        .insert(schemas)
        .values({ agentId, key: schemaKey, name: schemaName, parameters: t.parameters })
        .onConflictDoUpdate({
          target: [schemas.agentId, schemas.key],
          set: { name: schemaName, parameters: t.parameters },
        })
        .returning();
      schemaIdMap[t.name] = schemaRow.id;
      ctx.ids.schemaIds.push(schemaRow.id);
      log("info", `${schemaKey} (${schemaRow.id})`);
    }

    // ── Tools ──
    logSection("Seeding tools");

    for (const t of toolsSeed) {
      const key = t.key ?? toKey(t.name);

      const [row] = await ctx.db
        .insert(tools)
        .values({
          agentId,
          key,
          name: t.name,
          description: t.description,
          parametersSchemaId: schemaIdMap[t.name] ?? null,
          handler: t.handler ?? null,
          componentId: t.component ? ctx.componentKeyToId[t.component] ?? null : null,
          enabled: t.enabled,
        })
        .onConflictDoUpdate({
          target: [tools.agentId, tools.key],
          set: {
            name: t.name,
            description: t.description,
            parametersSchemaId: schemaIdMap[t.name] ?? null,
            handler: t.handler ?? null,
            componentId: t.component ? ctx.componentKeyToId[t.component] ?? null : null,
            agentId,
          },
        })
        .returning();
      ctx.ids.toolIds.push(row.id);
      ctx.toolNameToId[t.name] = row.id;
      log("info", `${row.name} (${row.id})${t.component ? ` [→${t.component}]` : ""}`);
    }

    // ── Tool test cases ──
    logSection("Seeding tool test cases");
    try {
      const toolTestCasesSeed = readJson<
        Record<string, Array<{
          name: string;
          input: Record<string, unknown>;
          expectedOutput?: unknown;
          tags?: string[];
        }>>
      >(join(ctx.agentDir, "tool-test-cases.json"));

      let total = 0;
      for (const [toolName, cases] of Object.entries(toolTestCasesSeed)) {
        const toolId = ctx.toolNameToId[toolName];
        if (!toolId) {
          log("warn", `tool "${toolName}" not found, skipping test cases`);
          continue;
        }

        await ctx.db.delete(toolTestCases).where(eq(toolTestCases.toolId, toolId));

        if (cases.length > 0) {
          await ctx.db.insert(toolTestCases).values(
            cases.map((tc) => ({
              toolId,
              name: tc.name,
              input: tc.input,
              expectedOutput: tc.expectedOutput ?? null,
              tags: tc.tags ?? [],
            })),
          );
        }
        total += cases.length;
        log("info", `${toolName}: ${cases.length} test cases`);
      }
      log("ok", `${total} tool test cases`);
    } catch (e) {
      log("warn", `seeding tool test cases: ${e}`);
    }
  },
};
