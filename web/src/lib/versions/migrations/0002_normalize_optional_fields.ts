import type { ExportMigration } from "./index";

/**
 * Migration 0002: Normalize optional fields to required with defaults.
 *
 * Consolidates all scattered fallback logic (previously in import/route.ts
 * and snapshot.ts) into a single migration script.
 */
export const migration0002: ExportMigration = {
  fromVersion: 1,
  toVersion: 2,
  description: "Normalize optional fields with default values",
  migrate(data) {
    const agent = data.agent as Record<string, unknown> | undefined;
    if (agent) {
      agent.ragEnabled = agent.ragEnabled ?? false;
    }

    // Top-level optional arrays → required (empty array default)
    data.files = data.files ?? [];
    data.embedTokens = data.embedTokens ?? [];

    // Snapshot-level fields
    const versions = data.versions as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(versions)) {
      for (const v of versions) {
        const snapshot = v.snapshot as Record<string, unknown> | undefined;
        if (!snapshot) continue;

        // tools[].uiHidden, tools[].testCases[].assertions
        const snapshotTools = snapshot.tools as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(snapshotTools)) {
          for (const t of snapshotTools) {
            t.uiHidden = t.uiHidden ?? false;
            const testCases = t.testCases as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(testCases)) {
              for (const tc of testCases) {
                tc.assertions = tc.assertions ?? [];
              }
            }
          }
        }

        // components[].testCases[].scenario
        const snapshotComponents = snapshot.components as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(snapshotComponents)) {
          for (const c of snapshotComponents) {
            const testCases = c.testCases as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(testCases)) {
              for (const tc of testCases) {
                tc.scenario = tc.scenario ?? "tool";
              }
            }
          }
        }

        // chatConfig.enableVoice, chatConfig.enableAttachment
        const chatConfig = snapshot.chatConfig as Record<string, unknown> | undefined;
        if (chatConfig) {
          chatConfig.enableVoice = chatConfig.enableVoice ?? false;
          chatConfig.enableAttachment = chatConfig.enableAttachment ?? false;
        }

        // judgeConfigs[].promptTemplate, judgeConfigs[].turnPromptTemplate
        const judgeConfigs = snapshot.judgeConfigs as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(judgeConfigs)) {
          for (const j of judgeConfigs) {
            j.promptTemplate = j.promptTemplate ?? null;
            j.turnPromptTemplate = j.turnPromptTemplate ?? null;
          }
        }
      }
    }

    return data;
  },
};
