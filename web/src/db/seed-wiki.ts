/**
 * 快速更新 wiki 文档。
 * 用法: make seed-wiki [AGENT=<slug>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { agents, wikiDocuments } from "./schema";

const slug = process.argv[2] || "gmcc-advisor";
const agentDir = join(__dirname, `seed-data/${slug}`);

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!);
  const db = drizzle({ client: sql });

  const [agent] = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(eq(agents.slug, slug))
    .limit(1);

  if (!agent) {
    console.error(`Agent ${slug} not found. Run \`make seed\` first.`);
    process.exit(1);
  }

  console.log(`Updating wiki documents for agent: ${agent.name} (${slug})`);

  const wikiDir = join(agentDir, "wiki");
  const mdFiles = readdirSync(wikiDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (let i = 0; i < mdFiles.length; i++) {
    const filename = mdFiles[i];
    const docSlug = filename.replace(/\.md$/, "");
    const raw = readFileSync(join(wikiDir, filename), "utf-8");
    const { data: frontmatter, content: body } = matter(raw);

    // frontmatter id/title take priority, fallback to slug/first-line
    const docId = (frontmatter.id as string) || `wiki-uw-${docSlug}`;
    const title =
      (frontmatter.title as string) || body.split("\n")[0].trim() || docSlug;

    // Store the entire file content (including frontmatter) as-is
    const content = raw;

    await db
      .insert(wikiDocuments)
      .values({ id: docId, title, content, order: i, agentId: agent.id })
      .onConflictDoUpdate({
        target: wikiDocuments.id,
        set: { title, content, order: i, agentId: agent.id },
      });
    console.log(`  ✓ ${title} (${docId})`);
  }

  console.log(`Updated ${mdFiles.length} wiki documents`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
