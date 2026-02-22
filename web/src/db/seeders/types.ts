import type { SeedDb } from "../seed-utils";

/** Shared context threaded through all seeders */
export interface SeedContext {
  db: SeedDb;
}

/** A single seeder module */
export interface Seeder {
  name: string;
  run(ctx: SeedContext): Promise<void>;
}
