import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  agents,
  agentMembers,
  users,
  chatConfigs,
  components,
  modelConfigs,
  datasets,
  functions,
  functionTestCases,
  tools,
  toolTestCases,
  wikiDocuments,
  evalCases,
  evalJudgeConfigs,
  evalRunResults,
  evalRuns,
} from "./schema";
import type { ToolParameter } from "@/lib/tools/types";
import { compileCssForComponent } from "@/lib/components/compile-css";
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
  datasetIds: string[];
  functionIds: string[];
  evalJudgeConfigId: string;
  evalCaseIds: string[];
}

// ── seed ──

export async function seed(db?: PostgresJsDatabase): Promise<SeedResult> {
  if (!db) {
    const { createClient } = await import("./client");
    const sql = createClient();
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

  // Seed users from seed-data/users.json
  console.log("Seeding users...");
  const seedUsers = readJson<
    Array<{
      id: string;
      clerk_id: string;
      email: string;
      nickname: string | null;
      avatar_url: string | null;
      bio: string | null;
      platform_role: "user" | "super_admin";
    }>
  >(join(__dirname, "seed-data/users.json"));

  for (const u of seedUsers) {
    await db
      .insert(users)
      .values({
        id: u.id,
        clerkId: u.clerk_id,
        email: u.email,
        nickname: u.nickname,
        avatarUrl: u.avatar_url,
        bio: u.bio,
        platformRole: u.platform_role,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: { email: u.email, avatarUrl: u.avatar_url },
      });
    console.log(`  - ${u.email} (${u.id})`);
  }

  // Seed agent members — make all users owners
  console.log("Seeding agent members...");
  const allUsers = await db.select({ id: users.id }).from(users);
  for (const u of allUsers) {
    await db
      .insert(agentMembers)
      .values({ agentId, userId: u.id, role: "owner" })
      .onConflictDoNothing();
  }
  console.log(`  - ${allUsers.length} user(s) added as owner`);

  // Seed components
  console.log("Seeding components...");

  const componentsDir = join(agentDir, "components");
  try {
    const componentFiles = readdirSync(componentsDir).filter(
      (f) => f.endsWith(".jsx") || f.endsWith(".tsx")
    );
    for (const file of componentFiles) {
      const key = file.replace(/\.(jsx|tsx)$/, "");
      const source = readFileSync(join(componentsDir, file), "utf-8");
      const name = key
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const generatedCss = await compileCssForComponent(source);

      await db
        .insert(components)
        .values({
          agentId,
          key,
          name,
          description: "",
          componentSource: source,
          componentMockData: "{}",
          generatedCss,
        })
        .onConflictDoUpdate({
          target: [components.agentId, components.key],
          set: { name, componentSource: source, generatedCss },
        });
      console.log(`  - ${key} (css: ${generatedCss.length} bytes)`);
    }
    console.log(`Seeded ${componentFiles.length} components`);
  } catch {
    // components dir may not exist
    console.log("  No components directory found, skipping");
  }

  // Seed system tools
  console.log("Seeding system tools...");

  const toolsSeed = readJson<
    Array<{
      key?: string;
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
    // Derive key from name if not provided
    const key = t.key ?? t.name.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();

    const [row] = await db
      .insert(tools)
      .values({ ...t, key, component: t.component ?? null, agentId })
      .onConflictDoUpdate({
        target: [tools.agentId, tools.key],
        set: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
          handler: t.handler ?? null,
          component: t.component ?? null,
          agentId,
        },
      })
      .returning();
    toolIds.push(row.id);
    console.log(`  - ${row.name} (${row.id})${t.component ? ` [→${t.component}]` : ""}`);
  }

  // Seed tool test cases
  console.log("Seeding tool test cases...");
  try {
    const toolTestCasesSeed = readJson<
      Record<string, Array<{
        name: string;
        input: Record<string, unknown>;
        expectedOutput?: unknown;
        tags?: string[];
      }>>
    >(join(agentDir, "tool-test-cases.json"));

    // Build name→id map from seeded tools
    const toolNameToId: Record<string, string> = {};
    for (let i = 0; i < toolsSeed.length; i++) {
      toolNameToId[toolsSeed[i].name] = toolIds[i];
    }

    let totalToolTestCases = 0;
    for (const [toolName, cases] of Object.entries(toolTestCasesSeed)) {
      const toolId = toolNameToId[toolName];
      if (!toolId) {
        console.warn(`  Warning: tool "${toolName}" not found, skipping test cases`);
        continue;
      }

      // Clear existing test cases for this tool before re-seeding
      await db.delete(toolTestCases).where(eq(toolTestCases.toolId, toolId));

      for (const tc of cases) {
        await db.insert(toolTestCases).values({
          toolId,
          name: tc.name,
          input: tc.input,
          expectedOutput: tc.expectedOutput ?? null,
          tags: tc.tags ?? [],
        });
        totalToolTestCases++;
      }
      console.log(`  - ${toolName}: ${cases.length} test cases`);
    }
    console.log(`Seeded ${totalToolTestCases} tool test cases`);
  } catch (e) {
    console.warn("  Warning seeding tool test cases:", e);
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
    const docId = `wiki-uw-${slug}`;
    const key = `wiki_uw_${slug}`;
    // Extract title from frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    let title = slug;
    if (fmMatch) {
      const titleMatch = fmMatch[1].match(/^title:\s*(.+)/m);
      if (titleMatch) title = titleMatch[1].trim();
    }

    await db
      .insert(wikiDocuments)
      .values({ id: docId, title, key, content, order: i, agentId })
      .onConflictDoUpdate({
        target: wikiDocuments.id,
        set: { title, key, content, order: i, agentId },
      });
  }

  console.log(`Seeded ${mdFiles.length} wiki documents`);

  // Seed model configs
  console.log("Seeding model configs...");

  const modelConfigSeed = readJson<
    Array<{
      key?: string;
      name: string;
      modelId?: string;
      systemPrompt: string;
      temperature: number;
      isActive: boolean;
    }>
  >(join(agentDir, "model-configs.json"));

  const modelConfigIds: string[] = [];
  for (const cfg of modelConfigSeed) {
    const key = cfg.key ?? cfg.name.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
    const [row] = await db
      .insert(modelConfigs)
      .values({ ...cfg, key, agentId })
      .onConflictDoUpdate({
        target: [modelConfigs.agentId, modelConfigs.key],
        set: {
          name: cfg.name,
          modelId: cfg.modelId ?? "",
          systemPrompt: cfg.systemPrompt,
          temperature: cfg.temperature,
          isActive: cfg.isActive,
        },
      })
      .returning();
    modelConfigIds.push(row.id);
    console.log(`  - ${row.key} (${row.id})${row.isActive ? " [active]" : ""}`);
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

  // Seed datasets (unified JSON store)
  console.log("Seeding datasets...");

  const datasetsSeed = readJson<
    Array<{
      key: string;
      name: string;
      description?: string;
      data: unknown;
    }>
  >(join(agentDir, "datasets.json"));

  const datasetIds: string[] = [];
  for (const ds of datasetsSeed) {
    const [row] = await db
      .insert(datasets)
      .values({
        agentId,
        key: ds.key,
        name: ds.name,
        description: ds.description ?? "",
        data: ds.data,
      })
      .onConflictDoUpdate({
        target: [datasets.agentId, datasets.key],
        set: {
          name: ds.name,
          description: ds.description ?? "",
          data: ds.data,
        },
      })
      .returning();
    datasetIds.push(row.id);
    console.log(`  - ${row.key} (${row.id})`);
  }
  // Seed pricing config datasets from JSON files
  const pricingConfigsDir = join(agentDir, "pricing-configs");
  try {
    const configFiles = readdirSync(pricingConfigsDir).filter((f) =>
      f.endsWith(".json")
    );
    for (const file of configFiles) {
      const key = `pricing_config_${file.replace(/\.json$/, "").replace(/-/g, "_")}`;
      const data = readJson<unknown>(join(pricingConfigsDir, file));
      const name = `Pricing Config: ${(data as { productName?: string }).productName ?? file}`;

      const [row] = await db
        .insert(datasets)
        .values({
          agentId,
          key,
          name,
          description: `Pricing configuration for ${name}`,
          data,
        })
        .onConflictDoUpdate({
          target: [datasets.agentId, datasets.key],
          set: { name, description: `Pricing configuration for ${name}`, data },
        })
        .returning();
      datasetIds.push(row.id);
      console.log(`  - ${row.key} [pricing config] (${row.id})`);
    }
    console.log(`Seeded ${configFiles.length} pricing config datasets`);
  } catch {
    // pricing-configs dir may not exist
  }

  console.log(`Seeded ${datasetsSeed.length} datasets (+ pricing configs)`);

  // Seed functions
  console.log("Seeding functions...");

  const functionsDir = join(agentDir, "functions");
  const functionIds: string[] = [];
  const functionMap: { id: string; key: string }[] = [];
  try {
    const fnFiles = readdirSync(functionsDir).filter((f) => f.endsWith(".js"));
    for (const file of fnFiles) {
      const key = file.replace(/\.js$/, "").replace(/-/g, "_");
      const code = readFileSync(join(functionsDir, file), "utf-8");
      const name = key
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      // Look for companion <key>.params.json and <key>.return-params.json
      const paramsFile = file.replace(/\.js$/, ".params.json");
      let parameters: ToolParameter[] = [];
      try {
        parameters = readJson<ToolParameter[]>(join(functionsDir, paramsFile));
      } catch {
        // No params file — use empty array
      }

      const returnParamsFile = file.replace(/\.js$/, ".return-params.json");
      let returnParameters: ToolParameter[] = [];
      try {
        returnParameters = readJson<ToolParameter[]>(join(functionsDir, returnParamsFile));
      } catch {
        // No return params file — use empty array
      }

      const [row] = await db
        .insert(functions)
        .values({
          agentId,
          key,
          name,
          description: "",
          code,
          parameters,
          returnParameters,
        })
        .onConflictDoUpdate({
          target: [functions.agentId, functions.key],
          set: { name, code, parameters, returnParameters },
        })
        .returning();
      functionIds.push(row.id);
      functionMap.push({ id: row.id, key: row.key });
      console.log(`  - ${row.key} (${row.id})${parameters.length > 0 ? ` [${parameters.length} params]` : ""}`);
    }
    console.log(`Seeded ${fnFiles.length} functions`);
  } catch {
    // functions dir may not exist
  }

  // Seed function test cases
  console.log("Seeding function test cases...");
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
        continue; // No test cases file
      }

      // Clear existing test cases for this function before re-seeding
      await db
        .delete(functionTestCases)
        .where(eq(functionTestCases.functionId, fnId));

      let count = 0;
      for (const tc of tcSeed) {
        await db
          .insert(functionTestCases)
          .values({
            functionId: fnId,
            name: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput ?? null,
            tags: tc.tags ?? [],
          });
        count++;
      }
      console.log(`  - ${fnKey}: ${count} test cases`);
    }
  } catch (e) {
    console.warn("  Warning seeding test cases:", e);
  }

  // Seed eval judge configs
  console.log("Seeding eval judge configs...");

  const judgeConfigSeed = readJson<{
    key?: string;
    name: string;
    model: string;
    systemPrompt: string;
    temperature: number;
    dimensions?: Dimension[];
    isDefault: boolean;
  }>(join(agentDir, "eval-judge-config.json"));

  const judgeKey = judgeConfigSeed.key ?? judgeConfigSeed.name.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
  const [judgeConfig] = await db
    .insert(evalJudgeConfigs)
    .values({ ...judgeConfigSeed, key: judgeKey, dimensions: judgeConfigSeed.dimensions ?? [], agentId })
    .onConflictDoUpdate({
      target: [evalJudgeConfigs.agentId, evalJudgeConfigs.key],
      set: {
        name: judgeConfigSeed.name,
        model: judgeConfigSeed.model,
        systemPrompt: judgeConfigSeed.systemPrompt,
        temperature: judgeConfigSeed.temperature,
        dimensions: judgeConfigSeed.dimensions ?? [],
        isDefault: judgeConfigSeed.isDefault,
      },
    })
    .returning();
  console.log(`  - ${judgeConfig.key} (${judgeConfig.id})`);

  // Clear eval runs
  console.log("Clearing eval runs...");
  await db.delete(evalRunResults);
  await db.delete(evalRuns);

  // Seed eval cases
  console.log("Seeding eval cases...");

  const evalCasesSeed = readJson<
    Array<{
      key?: string;
      name: string;
      input: string;
      expectedOutput: string;
      assertions: Array<Omit<Assertion, "id">>;
      tags: string[];
    }>
  >(join(agentDir, "eval-cases.json"));

  const evalCaseIds: string[] = [];
  for (const c of evalCasesSeed) {
    const key = c.key ?? c.name.replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();
    const [row] = await db
      .insert(evalCases)
      .values({
        key,
        name: c.name,
        input: c.input,
        expectedOutput: c.expectedOutput || null,
        assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
        tags: c.tags,
        agentId,
      })
      .onConflictDoUpdate({
        target: [evalCases.agentId, evalCases.key],
        set: {
          name: c.name,
          input: c.input,
          expectedOutput: c.expectedOutput || null,
          assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
          tags: c.tags,
        },
      })
      .returning();
    evalCaseIds.push(row.id);
  }
  console.log(`Seeded ${evalCasesSeed.length} eval cases`);

  return {
    agentId,
    toolIds,
    modelConfigIds,
    chatConfigId: chatConfig.id,
    datasetIds,
    functionIds,
    evalJudgeConfigId: judgeConfig.id,
    evalCaseIds,
  };
}

// ── CLI entry point ──

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("/seed.ts") || process.argv[1].endsWith("/seed.js"));

if (isDirectRun) {
  (async () => {
    const { createClient } = await import("./client");
    const sql = createClient();
    const db = drizzle({ client: sql });
    try {
      await seed(db);
    } finally {
      await sql.end();
    }
  })().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
