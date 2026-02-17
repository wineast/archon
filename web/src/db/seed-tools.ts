/**
 * 快速更新 tools 定义。
 * 用法: make seed-tools [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { agents, tools } from "./schema";
import type { ToolParameter } from "@/lib/tools/types";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

type ToolSeed = {
  name: string;
  description: string;
  parameters: ToolParameter[];
  handler?: string;
  enabled: boolean;
  component?: string;
};

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  const toolsSeed: ToolSeed[] = JSON.parse(
    readFileSync(join(agentDir, "tools.json"), "utf-8")
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

  console.log(`Updating tools for agent: ${agent.name} (${slug})`);

  for (const t of toolsSeed) {
    const [row] = await db
      .insert(tools)
      .values({ ...t, agentId: agent.id })
      .onConflictDoUpdate({
        target: tools.name,
        set: {
          description: t.description,
          parameters: t.parameters,
          handler: t.handler ?? null,
          component: t.component ?? null,
          agentId: agent.id,
        },
      })
      .returning();
    console.log(`  ✓ ${row.name} (${row.id})`);
  }

  console.log(`Updated ${toolsSeed.length} tools`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
