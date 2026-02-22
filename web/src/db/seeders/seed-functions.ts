import { join } from "path";
import { readFileSync } from "fs";
import { eq, sql } from "drizzle-orm";
import { functions, schemas, functionTestCases } from "../schema";
import { readJson, readDirSafe, fileNameToKey, keyToName, logSection, log } from "../seed-utils";
import type { JsonSchema7, SchemaProperty } from "@/lib/schemas/types";
import { migrateSchemaProperties } from "@/lib/schemas/migrate";
import type { Seeder } from "./types";

export const seedFunctions: Seeder = {
  name: "functions",
  async run(ctx) {
    const { agentId } = ctx;
    const functionsDir = join(ctx.agentDir, "functions");
    const fnFiles = readDirSafe(functionsDir).filter((f) => f.endsWith(".js"));

    if (fnFiles.length === 0) {
      logSection("Seeding functions");
      log("skip", "No functions directory found");
      return;
    }

    // ── Function parameter schemas ──
    logSection("Seeding function parameter schemas");

    const fnSchemaMap: Record<string, { paramsSchema: JsonSchema7 | null; returnParamsSchema: JsonSchema7 | null }> = {};
    for (const file of fnFiles) {
      const key = fileNameToKey(file);
      const name = keyToName(key);

      let paramsSchema: JsonSchema7 | null = null;
      let returnParamsSchema: JsonSchema7 | null = null;

      // Parameters schema
      const paramsFile = file.replace(/\.js$/, ".params.json");
      try {
        const rawParams = readJson<SchemaProperty[]>(join(functionsDir, paramsFile));
        if (rawParams.length > 0) {
          paramsSchema = migrateSchemaProperties(rawParams);
          // Still create schema in schemas table (for defsMap / ontology usage)
          const schemaKey = `${key}_params`;
          const schemaName = `${name} Parameters`;
          const [schemaRow] = await ctx.db
            .insert(schemas)
            .values({ agentId, versionId: ctx.versionId, key: schemaKey, name: schemaName, parameters: paramsSchema })
            .onConflictDoUpdate({
              target: [schemas.versionId, schemas.key],
              targetWhere: sql`deleted_at IS NULL`,
              set: { name: schemaName, parameters: paramsSchema },
            })
            .returning();
          ctx.ids.schemaIds.push(schemaRow.id);
          log("info", `${schemaKey} (${schemaRow.id})`);
        }
      } catch {
        // No params file
      }

      // Return parameters schema
      const returnParamsFile = file.replace(/\.js$/, ".return-params.json");
      try {
        const rawReturnParams = readJson<SchemaProperty[]>(join(functionsDir, returnParamsFile));
        if (rawReturnParams.length > 0) {
          returnParamsSchema = migrateSchemaProperties(rawReturnParams);
          const schemaKey = `${key}_return_params`;
          const schemaName = `${name} Return Parameters`;
          const [schemaRow] = await ctx.db
            .insert(schemas)
            .values({ agentId, versionId: ctx.versionId, key: schemaKey, name: schemaName, parameters: returnParamsSchema })
            .onConflictDoUpdate({
              target: [schemas.versionId, schemas.key],
              targetWhere: sql`deleted_at IS NULL`,
              set: { name: schemaName, parameters: returnParamsSchema },
            })
            .returning();
          ctx.ids.schemaIds.push(schemaRow.id);
          log("info", `${schemaKey} (${schemaRow.id})`);
        }
      } catch {
        // No return params file
      }

      fnSchemaMap[key] = { paramsSchema, returnParamsSchema };
    }

    // ── Functions ──
    logSection("Seeding functions");

    const functionMap: { id: string; key: string }[] = [];
    for (const file of fnFiles) {
      const key = fileNameToKey(file);
      const code = readFileSync(join(functionsDir, file), "utf-8");
      const name = keyToName(key);
      const { paramsSchema, returnParamsSchema } = fnSchemaMap[key];

      const [row] = await ctx.db
        .insert(functions)
        .values({
          agentId,
          versionId: ctx.versionId,
          key,
          name,
          description: "",
          code,
          parametersSchema: paramsSchema,
          returnParametersSchema: returnParamsSchema,
        })
        .onConflictDoUpdate({
          target: [functions.versionId, functions.key],
          targetWhere: sql`deleted_at IS NULL`,
          set: { name, code, parametersSchema: paramsSchema, returnParametersSchema: returnParamsSchema },
        })
        .returning();
      ctx.ids.functionIds.push(row.id);
      functionMap.push({ id: row.id, key: row.key });
      log("info", `${row.key} (${row.id})${paramsSchema ? " [schema]" : ""}`);
    }
    log("ok", `${fnFiles.length} functions`);

    // ── Function test cases ──
    logSection("Seeding function test cases");
    try {
      for (const { id: fnId, key: fnKey } of functionMap) {
        const tcFile = join(functionsDir, `${fnKey.replace(/_/g, "-")}.test-cases.json`);
        let tcSeed: Array<{
          name: string;
          input: Record<string, unknown>;
          expectedOutput?: unknown;
          tags?: string[];
        }>;
        try {
          tcSeed = readJson(tcFile);
        } catch {
          continue;
        }

        await ctx.db.delete(functionTestCases).where(eq(functionTestCases.functionId, fnId));

        if (tcSeed.length > 0) {
          await ctx.db.insert(functionTestCases).values(
            tcSeed.map((tc) => ({
              functionId: fnId,
              name: tc.name,
              input: tc.input,
              expectedOutput: tc.expectedOutput ?? null,
              tags: tc.tags ?? [],
            })),
          );
        }
        log("info", `${fnKey}: ${tcSeed.length} test cases`);
      }
    } catch (e) {
      log("warn", `seeding function test cases: ${e}`);
    }
  },
};
