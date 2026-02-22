import { describe, it, expect, vi, beforeEach } from "vitest";

let selectLimitResult: unknown[] = [];
const mockInsert = vi.fn();
const mockValues = vi.fn();

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
  agents: { id: "id", orgId: "orgId", slug: "slug" },
  modelConfigs: { agentId: "agentId" },
  tools: { agentId: "agentId" },
  orgSlots: { orgId: "orgId", slotKey: "slotKey", agentId: "agentId" },
  SLOT_KEYS: ["builder", "assist", "evaluator"],
}));

vi.mock("@/lib/build-chat/tools", () => ({
  buildAllTools: vi.fn().mockReturnValue({
    list_tools: { description: "List tools" },
    create_tool: { description: "Create tool" },
  }),
}));

import { ensureOrgDefaults } from "../ensure-org-defaults";

describe("ensureOrgDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimitResult = [];
  });

  it("creates 3 agents + modelConfigs + orgSlots when none exist", async () => {
    await ensureOrgDefaults("org-1");

    // For each of 3 slots: agent insert + modelConfig insert + orgSlot insert = 3 inserts
    // builder also gets tools insert = 1 extra
    // Total: 3*(agent + modelConfig + orgSlot) + 1 tools = 10
    expect(mockInsert).toHaveBeenCalledTimes(10);
  });

  it("seeds system tools only for builder slot", async () => {
    await ensureOrgDefaults("org-1");

    const toolsInsertCall = mockValues.mock.calls.find(
      (call) => Array.isArray(call[0]) && call[0][0]?.isSystem === true
    );

    expect(toolsInsertCall).toBeTruthy();
    expect(toolsInsertCall![0]).toHaveLength(2);
  });

  it("skips agent creation if agent already exists, but still ensures orgSlot", async () => {
    selectLimitResult = [{ id: "existing-agent" }];
    await ensureOrgDefaults("org-1");

    // Only orgSlot inserts for 3 slots = 3
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });
});
