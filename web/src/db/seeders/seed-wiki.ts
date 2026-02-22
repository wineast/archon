import { join } from "path";
import { readFileSync, readdirSync, statSync } from "fs";
import { wikiDocuments } from "../schema";
import { logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

interface WikiMeta {
  name: string;
  key: string;
  order?: number;
}

export const seedWiki: Seeder = {
  name: "wiki",
  async run(ctx) {
    logSection("Seeding wiki documents");

    const wikiDir = join(ctx.agentDir, "wiki");
    const slugs = readdirSync(wikiDir)
      .filter((f) => statSync(join(wikiDir, f)).isDirectory())
      .sort();

    const entries = slugs.map((slug, i) => {
      const dir = join(wikiDir, slug);
      const content = readFileSync(join(dir, "content.md"), "utf-8");
      const meta: WikiMeta = JSON.parse(
        readFileSync(join(dir, "meta.json"), "utf-8"),
      );

      return {
        name: meta.name,
        key: meta.key,
        content,
        order: meta.order ?? i,
      };
    });

    await Promise.all(
      entries.map((e) =>
        ctx.db
          .insert(wikiDocuments)
          .values({ ...e, agentId: ctx.agentId, versionId: ctx.versionId })
          .onConflictDoUpdate({
            target: [wikiDocuments.versionId, wikiDocuments.key],
            set: { name: e.name, content: e.content, order: e.order },
          }),
      ),
    );

    log("ok", `${slugs.length} wiki documents`);
  },
};
