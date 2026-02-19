export { seedModels } from "./seed-models";
export { seedPlatformSettings } from "./seed-platform-settings";
export { seedAgent } from "./seed-agent";
export { seedUsers } from "./seed-users";
export { seedOrgs } from "./seed-orgs";
export { seedComponents } from "./seed-components";
export { seedTools } from "./seed-tools";
export { seedWiki } from "./seed-wiki";
export { seedModelConfigs } from "./seed-model-configs";
export { seedChatConfig } from "./seed-chat-config";
export { seedDatasets } from "./seed-datasets";
export { seedFunctions } from "./seed-functions";
export { seedEval } from "./seed-eval";
export { seedVersion } from "./seed-version";

export type { SeedContext, SeedResult, Seeder } from "./types";

import type { Seeder } from "./types";
import { seedModels } from "./seed-models";
import { seedPlatformSettings } from "./seed-platform-settings";
import { seedAgent } from "./seed-agent";
import { seedUsers } from "./seed-users";
import { seedOrgs } from "./seed-orgs";
import { seedComponents } from "./seed-components";
import { seedTools } from "./seed-tools";
import { seedWiki } from "./seed-wiki";
import { seedModelConfigs } from "./seed-model-configs";
import { seedChatConfig } from "./seed-chat-config";
import { seedDatasets } from "./seed-datasets";
import { seedFunctions } from "./seed-functions";
import { seedEval } from "./seed-eval";
import { seedVersion } from "./seed-version";

/** The full seed pipeline in execution order. */
export const pipeline: Seeder[] = [
  seedModels,
  seedPlatformSettings,
  seedUsers,
  seedOrgs,
  seedAgent,
  seedComponents,
  seedDatasets,
  seedTools,
  seedWiki,
  seedModelConfigs,
  seedChatConfig,
  seedFunctions,
  seedEval,
  seedVersion,
];
