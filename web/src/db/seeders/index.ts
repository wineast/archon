export { seedModels } from "./seed-models";
export { seedBuiltinPool } from "./seed-builtin-pool";
export { seedUsers } from "./seed-users";

export type { SeedContext, Seeder } from "./types";

import type { Seeder } from "./types";
import { seedModels } from "./seed-models";
import { seedBuiltinPool } from "./seed-builtin-pool";
import { seedUsers } from "./seed-users";

/** Seed pipeline — models first, then builtin pool resources, then users (which auto-create personal orgs + slot agents). */
export const pipeline: Seeder[] = [
  seedModels,
  seedBuiltinPool,
  seedUsers,
];
