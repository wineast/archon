import { join } from "path";
import { readFileSync } from "fs";
import { eq } from "drizzle-orm";
import { components } from "../schema";
import { readDirSafe, logSection, log } from "../seed-utils";
import { compileCssForComponent } from "@/lib/components/compile-css";
import type { Seeder } from "./types";

export const seedComponents: Seeder = {
  name: "components",
  async run(ctx) {
    logSection("Seeding components");

    const componentsDir = join(ctx.agentDir, "components");
    const componentFiles = readDirSafe(componentsDir).filter(
      (f) => f.endsWith(".jsx") || f.endsWith(".tsx"),
    );

    if (componentFiles.length === 0) {
      log("skip", "No components directory found");
      return;
    }

    for (const file of componentFiles) {
      const key = file.replace(/\.(jsx|tsx)$/, "");
      const source = readFileSync(join(componentsDir, file), "utf-8");
      const name = key
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const generatedCss = await compileCssForComponent(source);

      await ctx.db
        .insert(components)
        .values({
          agentId: ctx.agentId,
          key,
          name,
          description: "",
          componentSource: source,
          generatedCss,
        })
        .onConflictDoUpdate({
          target: [components.agentId, components.key],
          set: { name, componentSource: source, generatedCss },
        });
      log("info", `${key} (css: ${generatedCss.length} bytes)`);
    }
    log("ok", `${componentFiles.length} components`);

    // Build componentKeyToId map
    const allComponentRows = await ctx.db
      .select({ id: components.id, key: components.key })
      .from(components)
      .where(eq(components.agentId, ctx.agentId));
    for (const c of allComponentRows) {
      ctx.componentKeyToId[c.key] = c.id;
    }
  },
};
