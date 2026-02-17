/**
 * 快速更新 eval cases（评估用例）。
 * 比完整 seed 快得多，只读 eval-cases.json 并 upsert 到 DB。
 *
 * 用法: make seed-eval [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { agents, evalCases } from "./schema";
import type { Assertion } from "@/lib/eval/types";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

type EvalCaseSeed = {
  name: string;
  input: string;
  expectedOutput: string;
  assertions: Array<Omit<Assertion, "id">>;
  tags: string[];
};

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  const cases: EvalCaseSeed[] = JSON.parse(
    readFileSync(join(agentDir, "eval-cases.json"), "utf-8")
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

  console.log(`Updating eval cases for agent: ${agent.name} (${slug})`);

  // Upsert 每个 eval case
  for (const c of cases) {
    const [row] = await db
      .insert(evalCases)
      .values({
        name: c.name,
        input: c.input,
        expectedOutput: c.expectedOutput || null,
        assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
        tags: c.tags,
        agentId: agent.id,
      })
      .onConflictDoUpdate({
        target: evalCases.name,
        set: {
          input: c.input,
          expectedOutput: c.expectedOutput || null,
          assertions: c.assertions.map((a): Assertion => ({ ...a, id: nanoid() })),
          tags: c.tags,
          agentId: agent.id,
        },
      })
      .returning({ id: evalCases.id, name: evalCases.name });

    console.log(`✓ ${row.name} (${row.id})`);
  }

  console.log(`\nDone: ${cases.length} eval cases updated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
