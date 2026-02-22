import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { eq } from "drizzle-orm";
import { components, componentTestCases } from "../schema";
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
          versionId: ctx.versionId,
          key,
          name,
          description: "",
          componentSource: source,
          generatedCss,
        })
        .onConflictDoUpdate({
          target: [components.versionId, components.key],
          set: { name, componentSource: source, generatedCss },
        });
      log("info", `${key} (css: ${generatedCss.length} bytes)`);
    }
    log("ok", `${componentFiles.length} components`);

    // Build componentKeyToId map
    const allComponentRows = await ctx.db
      .select({ id: components.id, key: components.key })
      .from(components)
      .where(eq(components.versionId, ctx.versionId));
    for (const c of allComponentRows) {
      ctx.componentKeyToId[c.key] = c.id;
    }

    // ── Component test cases ──
    const testCasesPath = join(ctx.agentDir, "component-test-cases.json");
    if (existsSync(testCasesPath)) {
      logSection("Seeding component test cases");
      try {
        const testCasesSeed = JSON.parse(
          readFileSync(testCasesPath, "utf-8")
        ) as Record<
          string,
          Array<{
            name: string;
            data: unknown;
            tags?: string[];
            scenario?: "tool" | "component";
            showAsExample?: boolean;
          }>
        >;

        let total = 0;
        for (const [compKey, cases] of Object.entries(testCasesSeed)) {
          const compId = ctx.componentKeyToId[compKey];
          if (!compId) {
            log("warn", `component "${compKey}" not found, skipping test cases`);
            continue;
          }

          await ctx.db
            .delete(componentTestCases)
            .where(eq(componentTestCases.componentId, compId));

          if (cases.length > 0) {
            await ctx.db.insert(componentTestCases).values(
              cases.map((tc) => ({
                componentId: compId,
                name: tc.name,
                data: tc.data,
                tags: tc.tags ?? [],
                scenario: tc.scenario ?? "tool",
                showAsExample: tc.showAsExample ?? false,
              }))
            );
          }
          total += cases.length;
          log("info", `${compKey}: ${cases.length} test cases`);
        }
        log("ok", `${total} component test cases`);
      } catch (e) {
        log("warn", `seeding component test cases: ${e}`);
      }
    }
  },
};
