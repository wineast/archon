import { describe, it, expect, vi, beforeEach } from "vitest";

// Track DB call results
// resolveSlot now makes at most 2 DB calls:
//   idx 0 = agentSlotOverrides query
//   idx 1 = modelConfigs query (only if override found)
let overrideResult: unknown[] = [];
let modelConfigResult: unknown[] = [];
let callIndex = 0;

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const idx = callIndex++;
            if (idx === 0) return overrideResult;
            if (idx === 1) return modelConfigResult;
            return [];
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agentSlotOverrides: { agentId: "agentId", slotKey: "slotKey", targetAgentId: "targetAgentId" },
  modelConfigs: { agentId: "agentId", modelId: "modelId", temperature: "temperature", isActive: "isActive" },
}));

import { resolveSlot, invalidateSlotCache } from "../resolve-slot";

describe("resolveSlot", () => {
  beforeEach(() => {
    invalidateSlotCache();
    overrideResult = [];
    modelConfigResult = [];
    callIndex = 0;
  });

  it("returns agent override when found", async () => {
    overrideResult = [{ targetAgentId: "override-agent" }];
    modelConfigResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    const result = await resolveSlot("my-agent", "builder");
    expect(result.agentId).toBe("override-agent");
    expect(result.model).toBe("openai/gpt-4o");
    expect(result.temperature).toBe(0.5);
  });

  it("falls back to null agentId when nothing configured", async () => {
    overrideResult = []; // no override

    const result = await resolveSlot("my-agent", "builder");
    expect(result.agentId).toBeNull();
    expect(result.model).toBe("");
    expect(result.temperature).toBe(0);
  });

  it("uses default model when modelConfig not found for override", async () => {
    overrideResult = [{ targetAgentId: "override-agent" }];
    modelConfigResult = []; // no modelConfig found

    const result = await resolveSlot("my-agent", "assist");
    expect(result.agentId).toBe("override-agent");
    expect(result.model).toBe("");
    expect(result.temperature).toBe(0.7);
  });

  it("caches results within TTL", async () => {
    overrideResult = [{ targetAgentId: "override-agent" }];
    modelConfigResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

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
    modelConfigResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    await resolveSlot("agent-x", "builder");
    invalidateSlotCache("agent-x");

    callIndex = 0;
    overrideResult = [{ targetAgentId: "new-override" }];
    modelConfigResult = [{ modelId: "new-model", temperature: 0.9 }];

    const result = await resolveSlot("agent-x", "builder");
    expect(result.agentId).toBe("new-override");
  });
});
