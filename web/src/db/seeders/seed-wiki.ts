import { join } from "path";
import { readFileSync, readdirSync } from "fs";
import { wikiDocuments } from "../schema";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedWiki: Seeder = {
  name: "wiki",
  async run(ctx) {
    logSection("Seeding wiki documents");

    const wikiDir = join(ctx.agentDir, "wiki");
    const mdFiles = readdirSync(wikiDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    // Parse all files synchronously, then upsert in parallel
    const entries = mdFiles.map((filename, i) => {
      const slug = filename.replace(/\.md$/, "");
      const content = readFileSync(join(wikiDir, filename), "utf-8");
      const key = `wiki_uw_${slug}`;

      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
      let title = slug;
      if (fmMatch) {
        const titleMatch = fmMatch[1].match(/^title:\s*(.+)/m);
        if (titleMatch) title = titleMatch[1].trim();
      }

      return { title, key, content, order: i };
    });

    await Promise.all(
      entries.map((e) =>
        ctx.db
          .insert(wikiDocuments)
          .values({ ...e, agentId: ctx.agentId })
          .onConflictDoUpdate({
            target: [wikiDocuments.agentId, wikiDocuments.key],
            set: { title: e.title, content: e.content, order: e.order },
          }),
      ),
    );

    log("ok", `${mdFiles.length} wiki documents`);
  },
};
