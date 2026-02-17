/**
 * 快速更新 data objects。
 * 用法: make seed-data-object [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { agents, dataObjects } from "./schema";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

type DataObjectSeed = {
  key: string;
  name: string;
  description: string;
  data: Record<string, unknown>;
};

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  const objectsSeed: DataObjectSeed[] = JSON.parse(
    readFileSync(join(agentDir, "data-objects.json"), "utf-8")
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

  console.log(`Updating data objects for agent: ${agent.name} (${slug})`);

  for (const lo of objectsSeed) {
    const [row] = await db
      .insert(dataObjects)
      .values({
        agentId: agent.id,
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

    console.log(`  ✓ ${row.key} (${row.id}) — ${Object.keys(lo.data).length} keys`);
  }

  console.log(`Updated ${objectsSeed.length} data objects`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
