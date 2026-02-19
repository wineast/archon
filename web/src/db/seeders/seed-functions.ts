import { join } from "path";
import { readFileSync } from "fs";
import { eq } from "drizzle-orm";
import { functions, schemas, functionTestCases } from "../schema";
import { readJson, readDirSafe, fileNameToKey, keyToName, logSection, log } from "../seed-utils";
import type { SchemaProperty } from "@/lib/schemas/types";
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

    const fnSchemaIdMap: Record<string, { paramsSchemaId: string | null; returnParamsSchemaId: string | null }> = {};
    for (const file of fnFiles) {
      const key = fileNameToKey(file);
      const name = keyToName(key);

      let paramsSchemaId: string | null = null;
      let returnParamsSchemaId: string | null = null;

      // Parameters schema
      const paramsFile = file.replace(/\.js$/, ".params.json");
      try {
        const parameters = readJson<SchemaProperty[]>(join(functionsDir, paramsFile));
        if (parameters.length > 0) {
          const schemaKey = `${key}_params`;
          const schemaName = `${name} Parameters`;
          const [schemaRow] = await ctx.db
            .insert(schemas)
            .values({ agentId, key: schemaKey, name: schemaName, parameters })
            .onConflictDoUpdate({
              target: [schemas.agentId, schemas.key],
              set: { name: schemaName, parameters },
            })
            .returning();
          paramsSchemaId = schemaRow.id;
          ctx.ids.schemaIds.push(schemaRow.id);
          log("info", `${schemaKey} (${schemaRow.id})`);
        }
      } catch {
        // No params file
      }

      // Return parameters schema
      const returnParamsFile = file.replace(/\.js$/, ".return-params.json");
      try {
        const returnParameters = readJson<SchemaProperty[]>(join(functionsDir, returnParamsFile));
        if (returnParameters.length > 0) {
          const schemaKey = `${key}_return_params`;
          const schemaName = `${name} Return Parameters`;
          const [schemaRow] = await ctx.db
            .insert(schemas)
            .values({ agentId, key: schemaKey, name: schemaName, parameters: returnParameters })
            .onConflictDoUpdate({
              target: [schemas.agentId, schemas.key],
              set: { name: schemaName, parameters: returnParameters },
            })
            .returning();
          returnParamsSchemaId = schemaRow.id;
          ctx.ids.schemaIds.push(schemaRow.id);
          log("info", `${schemaKey} (${schemaRow.id})`);
        }
      } catch {
        // No return params file
      }

      fnSchemaIdMap[key] = { paramsSchemaId, returnParamsSchemaId };
    }

    // ── Functions ──
    logSection("Seeding functions");

    const functionMap: { id: string; key: string }[] = [];
    for (const file of fnFiles) {
      const key = fileNameToKey(file);
      const code = readFileSync(join(functionsDir, file), "utf-8");
      const name = keyToName(key);
      const { paramsSchemaId, returnParamsSchemaId } = fnSchemaIdMap[key];

      const [row] = await ctx.db
        .insert(functions)
        .values({
          agentId,
          key,
          name,
          description: "",
          code,
          parametersSchemaId: paramsSchemaId,
          returnParametersSchemaId: returnParamsSchemaId,
        })
        .onConflictDoUpdate({
          target: [functions.agentId, functions.key],
          set: { name, code, parametersSchemaId: paramsSchemaId, returnParametersSchemaId: returnParamsSchemaId },
        })
        .returning();
      ctx.ids.functionIds.push(row.id);
      functionMap.push({ id: row.id, key: row.key });
      log("info", `${row.key} (${row.id})${paramsSchemaId ? " [schema]" : ""}`);
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
