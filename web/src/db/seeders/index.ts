export { seedModels } from "./seed-models";
export { seedUsers } from "./seed-users";

export type { SeedContext, Seeder } from "./types";

import type { Seeder } from "./types";
import { seedModels } from "./seed-models";
import { seedUsers } from "./seed-users";

/** Seed pipeline — models first, then users (which auto-create personal orgs + slot agents). */
export const pipeline: Seeder[] = [
  seedModels,
  seedUsers,
];
