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
  orgSlots: { orgId: "orgId", slotKey: "slotKey", agentId: "agentId" },
  embedTokens: Symbol("embedTokens"),
  SLOT_KEYS: ["builder", "assist", "evaluator", "support"],
}));

vi.mock("nanoid", () => ({
  nanoid: () => "mock-nanoid-token-32chars-abcdef",
}));

const mockEnsureBuiltinToolRefs = vi.fn();
vi.mock("@/lib/pool/seed-builtin-tools", () => ({
  ensureBuiltinToolRefs: (...args: unknown[]) => mockEnsureBuiltinToolRefs(...args),
}));

vi.mock("@/lib/pool/seed-builtin-functions", () => ({
  ensureBuiltinPoolFunctions: vi.fn(),
}));

const mockEnsureBuiltinPoolComponents = vi.fn();
vi.mock("@/lib/pool/seed-builtin-components", () => ({
  ensureBuiltinPoolComponents: (...args: unknown[]) => mockEnsureBuiltinPoolComponents(...args),
}));

import { ensureOrgDefaults } from "../ensure-org-defaults";

describe("ensureOrgDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimitResult = [];
  });

  it("creates 4 agents + modelConfigs + orgSlots when none exist", async () => {
    await ensureOrgDefaults("org-1");

    // For each of 4 slots: agent insert + agentVersion insert + modelConfig insert + orgSlot insert = 16
    // Plus 1 judgeConfig insert for evaluator slot = 17
    // Plus 1 embedToken insert for support slot = 18
    expect(mockInsert).toHaveBeenCalledTimes(18);
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

  it("skips agent creation if agent already exists, but still ensures orgSlot", async () => {
    selectLimitResult = [{ id: "existing-agent" }];
    await ensureOrgDefaults("org-1");

    // Only orgSlot inserts for 4 slots = 4
    expect(mockInsert).toHaveBeenCalledTimes(4);
  });
});
