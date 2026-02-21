export { seedModels } from "./seed-models";
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
export { seedMemory } from "./seed-memory";
export { seedMcpServers } from "./seed-mcp-servers";
export { seedEmbedToken } from "./seed-embed-token";

export type { SeedContext, SeedResult, Seeder } from "./types";

import type { Seeder } from "./types";
import { seedModels } from "./seed-models";
import { seedUsers } from "./seed-users";
import { seedOrgs } from "./seed-orgs";
import { seedAgent } from "./seed-agent";
import { seedComponents } from "./seed-components";
import { seedDatasets } from "./seed-datasets";
import { seedTools } from "./seed-tools";
import { seedWiki } from "./seed-wiki";
import { seedModelConfigs } from "./seed-model-configs";
import { seedChatConfig } from "./seed-chat-config";
import { seedFunctions } from "./seed-functions";
import { seedEval } from "./seed-eval";
import { seedVersion } from "./seed-version";
import { seedMemory } from "./seed-memory";
import { seedMcpServers } from "./seed-mcp-servers";
import { seedEmbedToken } from "./seed-embed-token";

/** Global seeders — run once before any agent. */
export const globalPipeline: Seeder[] = [
  seedModels,
  seedUsers,
  seedOrgs,
];

/** Per-agent seeder step. `requires` is a file/dir that must exist in agentDir. */
export interface AgentStep {
  seeder: Seeder;
  requires?: string;
}

/** Per-agent pipeline — run for each agent directory in seed-data/. */
export const agentPipeline: AgentStep[] = [
  { seeder: seedAgent },
  { seeder: seedComponents, requires: "components" },
  { seeder: seedDatasets, requires: "datasets.json" },
  { seeder: seedTools, requires: "tools.json" },
  { seeder: seedWiki, requires: "wiki" },
  { seeder: seedModelConfigs, requires: "model-configs.json" },
  { seeder: seedChatConfig, requires: "chat-config.json" },
  { seeder: seedFunctions, requires: "functions" },
  { seeder: seedEval, requires: "eval-cases.json" },
  { seeder: seedMemory, requires: "memory.json" },
  { seeder: seedMcpServers, requires: "mcp-servers.json" },
  { seeder: seedEmbedToken },
  { seeder: seedVersion },
];
