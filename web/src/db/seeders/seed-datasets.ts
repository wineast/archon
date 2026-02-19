import { join } from "path";
import { eq } from "drizzle-orm";
import { datasets } from "../schema";
import { readJson, readDirSafe, logSection, log } from "../seed-utils";
import type { Seeder } from "./types";

export const seedDatasets: Seeder = {
  name: "datasets",
  async run(ctx) {
    const { agentId } = ctx;

    logSection("Seeding datasets");

    const datasetsSeed = readJson<
      Array<{
        key: string;
        name: string;
        description?: string;
        data: unknown;
      }>
    >(join(ctx.agentDir, "datasets.json"));

    for (const ds of datasetsSeed) {
      const [row] = await ctx.db
        .insert(datasets)
        .values({
          agentId,
          key: ds.key,
          name: ds.name,
          description: ds.description ?? "",
          data: ds.data,
        })
        .onConflictDoUpdate({
          target: [datasets.agentId, datasets.key],
          set: { name: ds.name, description: ds.description ?? "", data: ds.data },
        })
        .returning();
      ctx.ids.datasetIds.push(row.id);
      log("info", `${row.key} (${row.id})`);
    }

    // Pricing config datasets
    const pricingConfigsDir = join(ctx.agentDir, "pricing-configs");
    const configFiles = readDirSafe(pricingConfigsDir).filter((f) => f.endsWith(".json"));

    for (const file of configFiles) {
      const key = `pricing_config_${file.replace(/\.json$/, "").replace(/-/g, "_")}`;
      const data = readJson<unknown>(join(pricingConfigsDir, file));
      const name = `Pricing Config: ${(data as { productName?: string }).productName ?? file}`;

      const [row] = await ctx.db
        .insert(datasets)
        .values({ agentId, key, name, description: `Pricing configuration for ${name}`, data })
        .onConflictDoUpdate({
          target: [datasets.agentId, datasets.key],
          set: { name, description: `Pricing configuration for ${name}`, data },
        })
        .returning();
      ctx.ids.datasetIds.push(row.id);
      log("info", `${row.key} [pricing config] (${row.id})`);
    }

    log("ok", `${datasetsSeed.length} datasets + ${configFiles.length} pricing configs`);

    // Build datasetKeyToId map for downstream seeders
    const allDatasetRows = await ctx.db
      .select({ id: datasets.id, key: datasets.key })
      .from(datasets)
      .where(eq(datasets.agentId, agentId));
    for (const d of allDatasetRows) {
      ctx.datasetKeyToId[d.key] = d.id;
    }
  },
};
