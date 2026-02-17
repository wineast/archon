/**
 * 快速更新 lookup tables。
 * 用法: make seed-lookup [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { agents, lookupTables, lookupEntries } from "./schema";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

type LookupTableSeed = {
  key: string;
  name: string;
  description: string;
  entries?: Array<{
    value: string;
    label?: string;
    metadata?: Record<string, unknown>;
  }>;
};

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  const tablesSeed: LookupTableSeed[] = JSON.parse(
    readFileSync(join(agentDir, "lookup-tables.json"), "utf-8")
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

  console.log(`Updating lookup tables for agent: ${agent.name} (${slug})`);

  for (const lt of tablesSeed) {
    const [row] = await db
      .insert(lookupTables)
      .values({
        agentId: agent.id,
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

    console.log(`  ✓ ${row.key} (${row.id}) — ${(lt.entries ?? []).length} entries`);
  }

  console.log(`Updated ${tablesSeed.length} lookup tables`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
