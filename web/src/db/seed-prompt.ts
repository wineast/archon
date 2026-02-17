/**
 * 快速更新 model config 的 systemPrompt。
 * 比完整 seed 快得多，只读 model-configs.json 并更新 DB 中对应行。
 *
 * 用法: make seed-prompt [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { agents, modelConfigs } from "./schema";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

type ModelConfigSeed = {
  name: string;
  modelId?: string;
  systemPrompt: string;
  temperature: number;
  isActive: boolean;
};

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  // 读取 seed 数据
  const configs: ModelConfigSeed[] = JSON.parse(
    readFileSync(join(agentDir, "model-configs.json"), "utf-8")
  );

  // 找到 agent
  const [agent] = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.slug, slug))
    .limit(1);

  if (!agent) {
    console.error(`Agent ${slug} not found. Run \`make seed\` first.`);
    process.exit(1);
  }

  console.log(`Updating model configs for agent: ${agent.name} (${slug})`);

  // 更新每个 model config
  for (const cfg of configs) {
    const result = await db
      .update(modelConfigs)
      .set({
        systemPrompt: cfg.systemPrompt,
        modelId: cfg.modelId ?? "",
        temperature: cfg.temperature,
        isActive: cfg.isActive,
      })
      .where(
        and(eq(modelConfigs.agentId, agent.id), eq(modelConfigs.name, cfg.name))
      )
      .returning({ id: modelConfigs.id, name: modelConfigs.name });

    if (result.length) {
      console.log(`✓ ${result[0].name} (${result[0].id}) updated`);
    } else {
      console.log(`⚠ ${cfg.name} not found in DB, skipping (run \`make seed\` first)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
