/**
 * 快速更新 template vars。
 * 比完整 seed 快得多，只读 template-vars.json 并 upsert 到 DB。
 *
 * 用法: make seed-vars [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { agents, templateVars } from "./schema";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

type TemplateVarSeed = {
  key: string;
  value: string;
  type?: "text" | "number" | "boolean" | "json";
  isArray?: boolean;
  description?: string;
};

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  const vars: TemplateVarSeed[] = JSON.parse(
    readFileSync(join(agentDir, "template-vars.json"), "utf-8")
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

  console.log(`Updating template vars for agent: ${agent.name} (${slug})`);

  for (const tv of vars) {
    const [row] = await db
      .insert(templateVars)
      .values({
        agentId: agent.id,
        key: tv.key,
        description: tv.description ?? null,
        value: tv.value,
        type: tv.type ?? "text",
        isArray: tv.isArray ?? false,
      })
      .onConflictDoUpdate({
        target: [templateVars.agentId, templateVars.key],
        set: {
          description: tv.description ?? null,
          value: tv.value,
          type: tv.type ?? "text",
          isArray: tv.isArray ?? false,
        },
      })
      .returning();
    console.log(`  \u2713 ${row.key} (${row.id})`);
  }

  console.log(`Updated ${vars.length} template vars`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
