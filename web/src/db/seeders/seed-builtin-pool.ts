import fs from "node:fs";
import path from "node:path";
import { tools, functions, functionTestCases, components, wikiDocuments } from "@/db/schema";
import { and, isNull, eq, sql, type SQL } from "drizzle-orm";
import {
  loadBuiltinToolDefs,
  loadBuiltinFunctionDefs,
  loadBuiltinComponentDefs,
  loadBuiltinWikiManifest,
  GUIDE_DIR,
} from "@/db/builtins";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";
import type { SeedDb } from "../seed-utils";

/* ── internal upsert helpers ── */

async function upsertTools(db: SeedDb): Promise<void> {
  const defs = loadBuiltinToolDefs();
  if (defs.length === 0) return;

  const rows = defs.map((def) => ({
    agentId: null as unknown as undefined,
    key: def.key,
    name: def.name,
    description: def.description,
    origin: "builtin" as const,
    enabled: true,
    handler: null,
    executionTarget: "server" as const,
    parametersSchema: def.parametersSchema,
  }));

  await db
    .insert(tools)
    .values(rows)
    .onConflictDoUpdate({
      target: [tools.key],
      targetWhere: and(isNull(tools.agentId), isNull(tools.deletedAt)) as SQL,
      set: {
        description: sql`excluded.description`,
        parametersSchema: sql`excluded.parameters_schema`,
      },
    });
}

async function upsertFunctions(db: SeedDb): Promise<void> {
  const defs = loadBuiltinFunctionDefs();

  for (const def of defs) {
    const [row] = await db
      .insert(functions)
      .values({
        agentId: null as unknown as undefined,
        key: def.key,
        name: def.name,
        description: def.description,
        code: def.code,
        parametersSchema: def.parametersSchema,
        returnParametersSchema: def.returnParametersSchema,
        origin: "builtin" as const,
      })
      .onConflictDoUpdate({
        target: [functions.key],
        targetWhere: and(isNull(functions.agentId), isNull(functions.deletedAt)) as SQL,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          code: sql`excluded.code`,
          parametersSchema: sql`excluded.parameters_schema`,
          returnParametersSchema: sql`excluded.return_parameters_schema`,
        },
      })
      .returning({ id: functions.id });

    if (!row) continue;

    if (def.testCases.length > 0) {
      // Delete existing test cases then re-insert (no unique constraint on name)
      await db.delete(functionTestCases).where(eq(functionTestCases.functionId, row.id));
      await db.insert(functionTestCases).values(
        def.testCases.map((tc) => ({
          functionId: row.id,
          name: tc.name,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          showAsExample: tc.showAsExample,
        })),
      );
    }
  }
}

async function upsertComponents(db: SeedDb): Promise<void> {
  const { compileCssForComponent } = await import("@/lib/components/compile-css");
  const defs = loadBuiltinComponentDefs();
  if (defs.length === 0) return;

  const rows = await Promise.all(
    defs.map(async (def) => {
      const componentSource = def.componentSource ?? "";
      const generatedCss = componentSource ? await compileCssForComponent(componentSource) : "";
      return {
        agentId: null as unknown as undefined,
        key: def.key,
        name: def.name,
        description: def.description,
        componentSource,
        generatedCss,
        componentInputSchema: def.componentInputSchema ?? null,
        origin: "builtin" as const,
      };
    }),
  );

  await db
    .insert(components)
    .values(rows)
    .onConflictDoUpdate({
      target: [components.key],
      targetWhere: and(isNull(components.agentId), isNull(components.deletedAt)) as SQL,
      set: {
        description: sql`excluded.description`,
        componentSource: sql`excluded.component_source`,
        generatedCss: sql`excluded.generated_css`,
      },
    });
}

async function upsertWiki(db: SeedDb): Promise<void> {
  const manifest = loadBuiltinWikiManifest();
  if (manifest.length === 0) return;

  const rows = manifest.map((entry) => {
    const filePath = path.join(GUIDE_DIR, entry.file);
    const content = fs.readFileSync(filePath, "utf-8");
    return {
      agentId: null as unknown as undefined,
      versionId: null as unknown as undefined,
      key: entry.key,
      name: entry.name,
      content,
      origin: "builtin" as const,
    };
  });

  await db
    .insert(wikiDocuments)
    .values(rows)
    .onConflictDoUpdate({
      target: [wikiDocuments.key],
      targetWhere: and(isNull(wikiDocuments.agentId), isNull(wikiDocuments.deletedAt)) as SQL,
      set: {
        name: sql`excluded.name`,
        content: sql`excluded.content`,
      },
    });
}

/* ── seeder ── */

export const seedBuiltinPool: Seeder = {
  name: "builtin-pool",
  async run(ctx) {
    logSection("Seeding builtin pool resources");

    await upsertTools(ctx.db);
    log("ok", "builtin pool tools");

    await upsertFunctions(ctx.db);
    log("ok", "builtin pool functions");

    await upsertComponents(ctx.db);
    log("ok", "builtin pool components");

    await upsertWiki(ctx.db);
    log("ok", "builtin pool wiki");
  },
};
