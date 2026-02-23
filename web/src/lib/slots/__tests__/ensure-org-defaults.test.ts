import { describe, it, expect, vi, beforeEach } from "vitest";

let selectLimitResult: unknown[] = [];
const mockInsert = vi.fn();
const mockValues = vi.fn();

const mockUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...a: unknown[]) => {
          mockValues(...a);
          return {
            returning: () => [{ id: "new-agent-id" }],
            onConflictDoNothing: () => [],
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: () => ({
          where: () => Promise.resolve(),
        }),
      };
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => selectLimitResult,
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: { id: "id", orgId: "orgId", slug: "slug", editingVersionId: "editingVersionId", publishedVersionId: "publishedVersionId" },
  agentVersions: { agentId: "agentId" },
  modelConfigs: { agentId: "agentId" },
  judgeConfigs: { agentId: "agentId" },
  tools: { agentId: "agentId" },
  components: Symbol("components"),
  embedTokens: Symbol("embedTokens"),
  SLOT_KEYS: ["builder", "assist", "evaluator", "support"],
}));

vi.mock("nanoid", () => ({
  nanoid: () => "mock-nanoid-token-32chars-abcdef",
}));

const mockEnsureBuiltinToolRefs = vi.fn();
const mockEnsureBuiltinWikiRefs = vi.fn();
vi.mock("@/lib/pool/builtin-refs", () => ({
  ensureBuiltinToolRefs: (...args: unknown[]) => mockEnsureBuiltinToolRefs(...args),
  ensureBuiltinWikiRefs: (...args: unknown[]) => mockEnsureBuiltinWikiRefs(...args),
}));

import { ensureOrgDefaults } from "../ensure-org-defaults";

describe("ensureOrgDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimitResult = [];
  });

  it("creates 4 agents + modelConfigs when none exist", async () => {
    await ensureOrgDefaults("org-1");

    // For each of 4 slots: agent insert + agentVersion insert + modelConfig insert = 12
    // Plus 1 judgeConfig insert for evaluator slot = 13
    // Plus 1 embedToken insert for support slot = 14
    expect(mockInsert).toHaveBeenCalledTimes(14);
  });

  it("seeds builtin tool refs only for builder slot", async () => {
    await ensureOrgDefaults("org-1");

    // ensureBuiltinToolRefs called once for builder slot
    expect(mockEnsureBuiltinToolRefs).toHaveBeenCalledTimes(1);
    // Second argument is the builder agent ID, third is the version ID
    expect(mockEnsureBuiltinToolRefs).toHaveBeenCalledWith(
      expect.anything(),
      "new-agent-id",
      "new-agent-id",
    );
  });

  it("seeds embed token only for support slot", async () => {
    await ensureOrgDefaults("org-1");

    // Check that embedTokens symbol was passed to insert for the support slot
    const embedTokensSymbol = (await import("@/db/schema")).embedTokens;
    const embedInsertCalls = mockInsert.mock.calls.filter(
      (call: unknown[]) => call[0] === embedTokensSymbol
    );
    expect(embedInsertCalls).toHaveLength(1);

    // Verify the embed token values
    const embedValuesCalls = mockValues.mock.calls;
    const embedCall = embedValuesCalls.find(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return val.name === "Support Widget";
      }
    );
    expect(embedCall).toBeDefined();
    expect((embedCall![0] as Record<string, unknown>).token).toMatch(/^et_/);
  });

  it("seeds builtin wiki refs only for assist slot", async () => {
    await ensureOrgDefaults("org-1");

    expect(mockEnsureBuiltinWikiRefs).toHaveBeenCalledTimes(1);
    expect(mockEnsureBuiltinWikiRefs).toHaveBeenCalledWith(
      expect.anything(),
      "new-agent-id",
      "new-agent-id",
    );
  });

  it("skips agent creation if agent already exists", async () => {
    selectLimitResult = [{ id: "existing-agent" }];
    await ensureOrgDefaults("org-1");

    // No inserts needed when agents already exist
    expect(mockInsert).toHaveBeenCalledTimes(0);
  });

  it("sets modelId to empty string for all slots", async () => {
    await ensureOrgDefaults("org-1");

    const modelConfigsSymbol = (await import("@/db/schema")).modelConfigs;
    const modelConfigInserts = mockInsert.mock.calls.filter(
      (call: unknown[]) => call[0] === modelConfigsSymbol
    );
    expect(modelConfigInserts).toHaveLength(4);

    const modelConfigValues = mockValues.mock.calls.filter(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return val.key === "default" && val.name === "Default" && "modelId" in val;
      }
    );
    for (const call of modelConfigValues) {
      const val = call[0] as Record<string, unknown>;
      expect(val.modelId).toBe("");
    }
  });

  it("sets non-empty systemPrompt for support slot model config", async () => {
    await ensureOrgDefaults("org-1");

    const modelConfigValues = mockValues.mock.calls.filter(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return val.key === "default" && val.name === "Default" && "systemPrompt" in val;
      }
    );

    // Find support slot's model config (4th slot, so 4th model config value call)
    // We verify by checking that at least one has a support-related prompt
    const supportConfig = modelConfigValues.find(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return typeof val.systemPrompt === "string" && (val.systemPrompt as string).includes("support assistant");
      }
    );
    expect(supportConfig).toBeDefined();
    expect((supportConfig![0] as Record<string, unknown>).systemPrompt).not.toBe("");
  });

  it("sets non-empty systemPrompt for evaluator slot model config", async () => {
    await ensureOrgDefaults("org-1");

    const modelConfigValues = mockValues.mock.calls.filter(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return val.key === "default" && val.name === "Default" && "systemPrompt" in val;
      }
    );

    const evaluatorConfig = modelConfigValues.find(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return typeof val.systemPrompt === "string" && (val.systemPrompt as string).includes("judge evaluating");
      }
    );
    expect(evaluatorConfig).toBeDefined();
  });

  it("sets non-empty systemPrompt with fieldContext for assist slot model config", async () => {
    await ensureOrgDefaults("org-1");

    const modelConfigValues = mockValues.mock.calls.filter(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return val.key === "default" && val.name === "Default" && "systemPrompt" in val;
      }
    );

    const assistConfig = modelConfigValues.find(
      (call: unknown[]) => {
        const val = call[0] as Record<string, unknown>;
        return typeof val.systemPrompt === "string" && (val.systemPrompt as string).includes("fieldContext");
      }
    );
    expect(assistConfig).toBeDefined();
    expect((assistConfig![0] as Record<string, unknown>).systemPrompt).not.toBe("");
  });

  it("backfills empty assist system prompt for existing agents", async () => {
    selectLimitResult = [{ id: "existing-agent" }];
    await ensureOrgDefaults("org-1");

    // Should call update for the assist slot's empty system prompt
    expect(mockUpdate).toHaveBeenCalled();
  });
});
