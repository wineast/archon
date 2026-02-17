import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  agents,
  chatConfigs,
  modelConfigs,
  templateVars,
  tools,
  wikiDocuments,
  evalCases,
  evalJudgeConfigs,
  evalRunResults,
  evalRuns,
  lookupTables,
  lookupEntries,
  dataObjects,
} from "./schema";
import type { ToolParameter } from "@/lib/tools/types";
import type { Assertion, Dimension } from "@/lib/eval/types";

// ── helpers ──

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

// ── types ──

export interface SeedResult {
  agentId: string;
  toolIds: string[];
  modelConfigIds: string[];
  chatConfigId: string;
  templateVarIds: string[];
  evalJudgeConfigId: string;
  evalCaseIds: string[];
  lookupTableIds: string[];
  dataObjectIds: string[];
}

// ── seed ──

export async function seed(db?: NeonHttpDatabase): Promise<SeedResult> {
  if (!db) {
    const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
    db = drizzle({ client: sql });
  }

  const agentDir = join(__dirname, "seed-data/gmcc-advisor");

  // Seed agent
  console.log("Seeding agent...");

  const agentSeed = readJson<{
    name: string;
    slug: string;
    description: string;
    icon: string;
  }>(join(agentDir, "agent.json"));

  const [agent] = await db
    .insert(agents)
    .values(agentSeed)
    .onConflictDoUpdate({
      target: agents.slug,
      set: {
        name: agentSeed.name,
        description: agentSeed.description,
        icon: agentSeed.icon,
      },
    })
    .returning();
  const agentId = agent.id;
  console.log(`  - ${agent.name} (${agent.id})`);

  // Seed system tools
  console.log("Seeding system tools...");

  const toolsSeed = readJson<
    Array<{
      name: string;
      description: string;
      parameters: ToolParameter[];
      handler?: string;
      enabled: boolean;
      component?: string;
    }>
  >(join(agentDir, "tools.json"));

  const toolIds: string[] = [];
  for (const t of toolsSeed) {
    const [row] = await db
      .insert(tools)
      .values({ ...t, agentId })
      .onConflictDoUpdate({
        target: tools.name,
        set: {
          description: t.description,
          parameters: t.parameters,
          handler: t.handler ?? null,
          component: t.component ?? null,
          agentId,
        },
      })
      .returning();
    toolIds.push(row.id);
    console.log(`  - ${row.name} (${row.id})`);
  }

  // Seed wiki documents
  console.log("Seeding wiki documents...");

  const wikiDir = join(agentDir, "wiki");
  const mdFiles = readdirSync(wikiDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (let i = 0; i < mdFiles.length; i++) {
    const filename = mdFiles[i];
    const slug = filename.replace(/\.md$/, "");
    const content = readFileSync(join(wikiDir, filename), "utf-8");
    const title = content.split("\n")[0].trim() || slug;
    const docId = `wiki-uw-${slug}`;

    await db
      .insert(wikiDocuments)
      .values({ id: docId, title, content, order: i, agentId })
      .onConflictDoUpdate({
        target: wikiDocuments.id,
        set: { title, content, order: i, agentId },
      });
  }

  console.log(`Seeded ${mdFiles.length} wiki documents`);

  // Seed model configs
  console.log("Seeding model configs...");

  const modelConfigSeed = readJson<
    Array<{
      name: string;
      modelId?: string;
      systemPrompt: string;
      temperature: number;
      isActive: boolean;
    }>
  >(join(agentDir, "model-configs.json"));

  const modelConfigIds: string[] = [];
  for (const cfg of modelConfigSeed) {
    const [row] = await db
      .insert(modelConfigs)
      .values({ ...cfg, agentId })
      .onConflictDoUpdate({
        target: modelConfigs.name,
        set: {
          modelId: cfg.modelId ?? "",
          systemPrompt: cfg.systemPrompt,
          temperature: cfg.temperature,
          isActive: cfg.isActive,
          agentId,
        },
      })
      .returning();
    modelConfigIds.push(row.id);
    console.log(`  - ${row.name} (${row.id})${row.isActive ? " [active]" : ""}`);
  }

  // Seed chat config
  console.log("Seeding chat config...");

  const chatConfigSeed = readJson<{
    title: string;
    welcomeTitle: string;
    welcomeIcon: string;
    quickActions: string[];
    placeholder: string;
    suggestions: string[];
  }>(join(agentDir, "chat-config.json"));

  const [chatConfig] = await db
    .insert(chatConfigs)
    .values({ ...chatConfigSeed, agentId })
    .onConflictDoUpdate({
      target: chatConfigs.agentId,
      set: {
        title: chatConfigSeed.title,
        welcomeTitle: chatConfigSeed.welcomeTitle,
        welcomeIcon: chatConfigSeed.welcomeIcon,
        quickActions: chatConfigSeed.quickActions,
        placeholder: chatConfigSeed.placeholder,
        suggestions: chatConfigSeed.suggestions,
      },
    })
    .returning();
  console.log(`  - chat config (${chatConfig.id})`);

  // Seed template vars
  console.log("Seeding template vars...");

  const templateVarsSeed = readJson<
    Array<{ key: string; value: string; type?: string; isArray?: boolean; description?: string }>
  >(join(agentDir, "template-vars.json"));

  const templateVarIds: string[] = [];
  for (const tv of templateVarsSeed) {
    const [row] = await db
      .insert(templateVars)
      .values({
        agentId,
        key: tv.key,
        description: tv.description ?? null,
        value: tv.value,
        type: (tv.type as "text" | "number" | "boolean" | "json") ?? "text",
        isArray: tv.isArray ?? false,
      })
      .onConflictDoUpdate({
        target: [templateVars.agentId, templateVars.key],
        set: {
          description: tv.description ?? null,
          value: tv.value,
          type: (tv.type as "text" | "number" | "boolean" | "json") ?? "text",
          isArray: tv.isArray ?? false,
        },
      })
      .returning();
    templateVarIds.push(row.id);
    console.log(`  - ${row.key} (${row.id})`);
  }
  console.log(`Seeded ${templateVarsSeed.length} template vars`);

  // Seed eval judge configs
  console.log("Seeding eval judge configs...");

  const judgeConfigSeed = readJson<{
    name: string;
    model: string;
    systemPrompt: string;
    temperature: number;
    dimensions?: Dimension[];
    isDefault: boolean;
  }>(join(agentDir, "eval-judge-config.json"));

  const [judgeConfig] = await db
    .insert(evalJudgeConfigs)
    .values({ ...judgeConfigSeed, dimensions: judgeConfigSeed.dimensions ?? [], agentId })
    .onConflictDoUpdate({
      target: evalJudgeConfigs.name,
      set: {
        model: judgeConfigSeed.model,
        systemPrompt: judgeConfigSeed.systemPrompt,
        temperature: judgeConfigSeed.temperature,
        dimensions: judgeConfigSeed.dimensions ?? [],
        isDefault: judgeConfigSeed.isDefault,
        agentId,
      },
    })
    .returning();
  console.log(`  - ${judgeConfig.name} (${judgeConfig.id})`);

  // Clear eval runs
  console.log("Clearing eval runs...");
  await db.delete(evalRunResults);
  await db.delete(evalRuns);

  // Seed eval cases
  console.log("Seeding eval cases...");

  const evalCasesSeed = readJson<
    Array<{
      name: string;
      input: string;
      expectedOutput: string;
      assertions: Array<Omit<Assertion, "id">>;
      tags: string[];
    }>
  >(join(agentDir, "eval-cases.json"));

  const evalCaseIds: string[] = [];
  for (const c of evalCasesSeed) {
    const [row] = await db
      .insert(evalCases)
      .values({
        name: c.name,
        input: c.input,
        expectedOutput: c.expectedOutput || null,
        assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
        tags: c.tags,
        agentId,
      })
      .onConflictDoUpdate({
        target: evalCases.name,
        set: {
          input: c.input,
          expectedOutput: c.expectedOutput || null,
          assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
          tags: c.tags,
          agentId,
        },
      })
      .returning();
    evalCaseIds.push(row.id);
  }
  console.log(`Seeded ${evalCasesSeed.length} eval cases`);

  // Seed lookup tables
  console.log("Seeding lookup tables...");

  const lookupTablesSeed = readJson<
    Array<{
      key: string;
      name: string;
      description: string;
      entries?: Array<{
        value: string;
        label?: string;
        metadata?: Record<string, unknown>;
      }>;
    }>
  >(join(agentDir, "lookup-tables.json"));

  const lookupTableIds: string[] = [];
  for (const lt of lookupTablesSeed) {
    const [row] = await db
      .insert(lookupTables)
      .values({
        agentId,
        key: lt.key,
        name: lt.name,
        description: lt.description,
      })
      .onConflictDoUpdate({
        target: [lookupTables.agentId, lookupTables.key],
        set: {
          name: lt.name,
          description: lt.description,
        },
      })
      .returning();
    lookupTableIds.push(row.id);
    console.log(`  - ${row.key} (${row.id})`);

    if (lt.entries) {
      for (let i = 0; i < lt.entries.length; i++) {
        const entry = lt.entries[i];
        await db
          .insert(lookupEntries)
          .values({
            tableId: row.id,
            value: entry.value,
            label: entry.label ?? null,
            metadata: entry.metadata ?? null,
            order: i,
          })
          .onConflictDoUpdate({
            target: [lookupEntries.tableId, lookupEntries.value],
            set: {
              label: entry.label ?? null,
              metadata: entry.metadata ?? null,
              order: i,
            },
          });
      }
    }
  }
  console.log(`Seeded ${lookupTablesSeed.length} lookup tables`);

  // Seed data objects
  console.log("Seeding data objects...");

  const dataObjectsSeed = readJson<
    Array<{
      key: string;
      name: string;
      description: string;
      data: Record<string, unknown>;
    }>
  >(join(agentDir, "data-objects.json"));

  const dataObjectIds: string[] = [];
  for (const lo of dataObjectsSeed) {
    const [row] = await db
      .insert(dataObjects)
      .values({
        agentId,
        key: lo.key,
        name: lo.name,
        description: lo.description,
        data: lo.data,
      })
      .onConflictDoUpdate({
        target: [dataObjects.agentId, dataObjects.key],
        set: {
          name: lo.name,
          description: lo.description,
          data: lo.data,
        },
      })
      .returning();
    dataObjectIds.push(row.id);
    console.log(`  - ${row.key} (${row.id})`);
  }
  console.log(`Seeded ${dataObjectsSeed.length} data objects`);

  return {
    agentId,
    toolIds,
    modelConfigIds,
    chatConfigId: chatConfig.id,
    templateVarIds,
    evalJudgeConfigId: judgeConfig.id,
    evalCaseIds,
    lookupTableIds,
    dataObjectIds,
  };
}

// ── CLI entry point ──

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("/seed.ts") || process.argv[1].endsWith("/seed.js"));

if (isDirectRun) {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
