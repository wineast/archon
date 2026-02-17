/**
 * 快速更新 chat config。
 * 比完整 seed 快得多，只读 chat-config.json 并更新 DB 中对应行。
 *
 * 用法: make seed-chat [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { agents, chatConfigs } from "./schema";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

type ChatConfigSeed = {
  title: string;
  welcomeTitle: string;
  welcomeIcon: string;
  quickActions: string[];
  placeholder: string;
  suggestions: string[];
};

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  const seed: ChatConfigSeed = JSON.parse(
    readFileSync(join(agentDir, "chat-config.json"), "utf-8")
  );

  const [agent] = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.slug, slug))
    .limit(1);

  if (!agent) {
    console.error(`Agent ${slug} not found. Run \`make seed\` first.`);
    process.exit(1);
  }

  console.log(`Updating chat config for agent: ${agent.name} (${slug})`);

  const result = await db
    .update(chatConfigs)
    .set({
      title: seed.title,
      welcomeTitle: seed.welcomeTitle,
      welcomeIcon: seed.welcomeIcon,
      quickActions: seed.quickActions,
      placeholder: seed.placeholder,
      suggestions: seed.suggestions,
    })
    .where(eq(chatConfigs.agentId, agent.id))
    .returning({ id: chatConfigs.id });

  if (result.length) {
    console.log(`✓ chat config (${result[0].id}) updated`);
  } else {
    console.log(`⚠ chat config not found in DB, skipping (run \`make seed\` first)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
