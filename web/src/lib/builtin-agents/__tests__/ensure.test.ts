import { describe, it, expect, vi, beforeEach } from "vitest";

// Track what db.select().from().where().limit() returns
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
}));

vi.mock("@/lib/build-chat/tools", () => ({
  buildAllTools: vi.fn().mockReturnValue({
    list_tools: { description: "List tools" },
    create_tool: { description: "Create tool" },
  }),
}));

import { ensureBuiltinAgents } from "../ensure";

describe("ensureBuiltinAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimitResult = []; // No existing agents
  });

  it("creates build-chat and assist agents when none exist", async () => {
    await ensureBuiltinAgents("org-1");

    // insert: agent(2) + modelConfig(2) + tools(1 batch) = 5
    expect(mockInsert).toHaveBeenCalledTimes(5);
  });

  it("seeds system tools for build-chat agent", async () => {
    await ensureBuiltinAgents("org-1");

    const toolsInsertCall = mockValues.mock.calls.find(
      (call) => Array.isArray(call[0]) && call[0][0]?.isSystem === true
    );

    expect(toolsInsertCall).toBeTruthy();
    expect(toolsInsertCall![0]).toHaveLength(2);
    expect(toolsInsertCall![0][0].key).toBe("list_tools");
    expect(toolsInsertCall![0][1].key).toBe("create_tool");
  });
});

describe("ensureBuiltinAgents idempotent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectLimitResult = [{ id: "existing-agent" }]; // Agents already exist
  });

  it("does not create agents if they already exist", async () => {
    await ensureBuiltinAgents("org-1");

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
