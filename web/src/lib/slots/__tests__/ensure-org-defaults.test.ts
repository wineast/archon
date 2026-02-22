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
  tools: { agentId: "agentId" },
  components: Symbol("components"),
  orgSlots: { orgId: "orgId", slotKey: "slotKey", agentId: "agentId" },
  SLOT_KEYS: ["builder", "assist", "evaluator"],
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

  it("creates 3 agents + modelConfigs + orgSlots when none exist", async () => {
    await ensureOrgDefaults("org-1");

    // For each of 3 slots: agent insert + agentVersion insert + modelConfig insert + orgSlot insert = 12
    expect(mockInsert).toHaveBeenCalledTimes(12);
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

  it("skips agent creation if agent already exists, but still ensures orgSlot", async () => {
    selectLimitResult = [{ id: "existing-agent" }];
    await ensureOrgDefaults("org-1");

    // Only orgSlot inserts for 3 slots = 3
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });
});
