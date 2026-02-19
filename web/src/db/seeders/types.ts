import type { SeedDb } from "../seed-utils";

/** Shared context threaded through all seeders */
export interface SeedContext {
  db: SeedDb;
  orgId: string;
  agentId: string;
  agentDir: string;
  /** component key → id */
  componentKeyToId: Record<string, string>;
  /** tool name → id */
  toolNameToId: Record<string, string>;
  /** dataset key → id */
  datasetKeyToId: Record<string, string>;
  /** Accumulated IDs returned by earlier seeders */
  ids: {
    toolIds: string[];
    schemaIds: string[];
    modelConfigIds: string[];
    chatConfigId: string;
    datasetIds: string[];
    functionIds: string[];
    evalJudgeConfigId: string;
    evalCaseIds: string[];
  };
}

/** Return value of the full seed pipeline */
export interface SeedResult {
  agentId: string;
  toolIds: string[];
  schemaIds: string[];
  modelConfigIds: string[];
  chatConfigId: string;
  datasetIds: string[];
  functionIds: string[];
  evalJudgeConfigId: string;
  evalCaseIds: string[];
}

/** A single seeder module */
export interface Seeder {
  name: string;
  run(ctx: SeedContext): Promise<void>;
}
