import { describe, it, expect, vi, beforeEach } from "vitest";

// Track DB call results
let overrideResult: unknown[] = [];
let agentResult: unknown[] = [];
let orgSlotResult: unknown[] = [];
let modelConfigResult: unknown[] = [];
let callIndex = 0;

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const idx = callIndex++;
            // Call order depends on path:
            // resolveSlot: 0=override, 1=agent, 2=orgSlot, 3=modelConfig
            // or: 0=override, 1=modelConfig (if override found)
            const results = [overrideResult, agentResult, orgSlotResult, modelConfigResult];
            return results[idx] ?? [];
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: { id: "id", orgId: "orgId" },
  agentSlotOverrides: { agentId: "agentId", slotKey: "slotKey", targetAgentId: "targetAgentId" },
  orgSlots: { orgId: "orgId", slotKey: "slotKey", agentId: "agentId" },
  modelConfigs: { agentId: "agentId", modelId: "modelId", temperature: "temperature", isActive: "isActive" },
}));

import { resolveSlot, invalidateSlotCache } from "../resolve-slot";

describe("resolveSlot", () => {
  beforeEach(() => {
    invalidateSlotCache();
    overrideResult = [];
    agentResult = [];
    orgSlotResult = [];
    modelConfigResult = [];
    callIndex = 0;
  });

  it("returns agent override when found", async () => {
    overrideResult = [{ targetAgentId: "override-agent" }];
    // Next call is getActiveModelConfig for the override target
    agentResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }]; // reused as modelConfig result at idx=1

    const result = await resolveSlot("my-agent", "builder");
    expect(result.agentId).toBe("override-agent");
    expect(result.model).toBe("openai/gpt-4o");
    expect(result.temperature).toBe(0.5);
  });

  it("falls back to org slot when no override", async () => {
    overrideResult = []; // no override
    agentResult = [{ orgId: "org-1" }]; // agent row
    orgSlotResult = [{ agentId: "org-slot-agent" }]; // org slot
    modelConfigResult = [{ modelId: "anthropic/claude-sonnet-4", temperature: 0.3 }];

    const result = await resolveSlot("my-agent", "builder");
    expect(result.agentId).toBe("org-slot-agent");
    expect(result.model).toBe("anthropic/claude-sonnet-4");
  });

  it("falls back to hardcoded defaults when nothing configured", async () => {
    overrideResult = [];
    agentResult = [{ orgId: "org-1" }];
    orgSlotResult = [];
    // No modelConfig call needed

    const result = await resolveSlot("my-agent", "builder");
    expect(result.agentId).toBe("");
    expect(result.model).toBe("");
    expect(result.temperature).toBe(0.3);
  });

  it("uses default model when modelConfig not found for override", async () => {
    overrideResult = [{ targetAgentId: "override-agent" }];
    agentResult = []; // no modelConfig found

    const result = await resolveSlot("my-agent", "assist");
    expect(result.agentId).toBe("override-agent");
    expect(result.model).toBe("");
    expect(result.temperature).toBe(0.7);
  });

  it("caches results within TTL", async () => {
    overrideResult = [{ targetAgentId: "override-agent" }];
    agentResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    const result1 = await resolveSlot("cached-agent", "builder");
    const savedCallIndex = callIndex;

    // Change results - should not affect cached result
    overrideResult = [];
    callIndex = savedCallIndex; // don't reset

    const result2 = await resolveSlot("cached-agent", "builder");
    expect(result2.agentId).toBe(result1.agentId);
    expect(callIndex).toBe(savedCallIndex); // no new DB calls
  });

  it("invalidates cache for specific agent", async () => {
    overrideResult = [{ targetAgentId: "override-agent" }];
    agentResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    await resolveSlot("agent-x", "builder");
    invalidateSlotCache("agent-x");

    callIndex = 0;
    overrideResult = [{ targetAgentId: "new-override" }];
    agentResult = [{ modelId: "new-model", temperature: 0.9 }];

    const result = await resolveSlot("agent-x", "builder");
    expect(result.agentId).toBe("new-override");
  });
});
