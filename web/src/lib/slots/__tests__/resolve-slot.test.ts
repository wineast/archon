import { describe, it, expect, vi, beforeEach } from "vitest";

// Track DB call results
// resolveAgentSlot/resolveOrgSlot makes at most 2 DB calls:
//   idx 0 = agentSlots/orgSlots query
//   idx 1 = modelConfigs query (only if binding found)
let bindingResult: unknown[] = [];
let modelConfigResult: unknown[] = [];
let callIndex = 0;

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const idx = callIndex++;
            if (idx === 0) return bindingResult;
            if (idx === 1) return modelConfigResult;
            return [];
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agentSlots: { agentId: "agentId", slotKey: "slotKey", targetAgentId: "targetAgentId" },
  orgSlots: { orgId: "orgId", slotKey: "slotKey", targetAgentId: "targetAgentId" },
  modelConfigs: { agentId: "agentId", modelId: "modelId", temperature: "temperature", isActive: "isActive" },
}));

import { resolveAgentSlot, resolveOrgSlot, invalidateSlotCache } from "../resolve-slot";

describe("resolveAgentSlot", () => {
  beforeEach(() => {
    invalidateSlotCache();
    bindingResult = [];
    modelConfigResult = [];
    callIndex = 0;
  });

  it("returns agent binding when found", async () => {
    bindingResult = [{ targetAgentId: "override-agent" }];
    modelConfigResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    const result = await resolveAgentSlot("my-agent", "builder");
    expect(result.agentId).toBe("override-agent");
    expect(result.model).toBe("openai/gpt-4o");
    expect(result.temperature).toBe(0.5);
  });

  it("falls back to null agentId when nothing configured", async () => {
    bindingResult = [];

    const result = await resolveAgentSlot("my-agent", "builder");
    expect(result.agentId).toBeNull();
    expect(result.model).toBe("");
    expect(result.temperature).toBe(0);
  });

  it("uses default model when modelConfig not found for binding", async () => {
    bindingResult = [{ targetAgentId: "override-agent" }];
    modelConfigResult = [];

    const result = await resolveAgentSlot("my-agent", "assist");
    expect(result.agentId).toBe("override-agent");
    expect(result.model).toBe("");
    expect(result.temperature).toBe(0.7);
  });

  it("caches results within TTL", async () => {
    bindingResult = [{ targetAgentId: "override-agent" }];
    modelConfigResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    const result1 = await resolveAgentSlot("cached-agent", "builder");
    const savedCallIndex = callIndex;

    bindingResult = [];
    callIndex = savedCallIndex;

    const result2 = await resolveAgentSlot("cached-agent", "builder");
    expect(result2.agentId).toBe(result1.agentId);
    expect(callIndex).toBe(savedCallIndex);
  });

  it("invalidates cache for specific agent", async () => {
    bindingResult = [{ targetAgentId: "override-agent" }];
    modelConfigResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    await resolveAgentSlot("agent-x", "builder");
    invalidateSlotCache("agent-x");

    callIndex = 0;
    bindingResult = [{ targetAgentId: "new-override" }];
    modelConfigResult = [{ modelId: "new-model", temperature: 0.9 }];

    const result = await resolveAgentSlot("agent-x", "builder");
    expect(result.agentId).toBe("new-override");
  });
});

describe("resolveOrgSlot", () => {
  beforeEach(() => {
    invalidateSlotCache();
    bindingResult = [];
    modelConfigResult = [];
    callIndex = 0;
  });

  it("returns org binding when found", async () => {
    bindingResult = [{ targetAgentId: "support-agent" }];
    modelConfigResult = [{ modelId: "anthropic/claude-sonnet-4", temperature: 0.7 }];

    const result = await resolveOrgSlot("my-org", "support");
    expect(result.agentId).toBe("support-agent");
    expect(result.model).toBe("anthropic/claude-sonnet-4");
    expect(result.temperature).toBe(0.7);
  });

  it("falls back to null agentId when nothing configured", async () => {
    bindingResult = [];

    const result = await resolveOrgSlot("my-org", "support");
    expect(result.agentId).toBeNull();
    expect(result.model).toBe("");
    expect(result.temperature).toBe(0);
  });

  it("caches results within TTL", async () => {
    bindingResult = [{ targetAgentId: "support-agent" }];
    modelConfigResult = [{ modelId: "anthropic/claude-sonnet-4", temperature: 0.7 }];

    const result1 = await resolveOrgSlot("cached-org", "support");
    const savedCallIndex = callIndex;

    bindingResult = [];
    callIndex = savedCallIndex;

    const result2 = await resolveOrgSlot("cached-org", "support");
    expect(result2.agentId).toBe(result1.agentId);
    expect(callIndex).toBe(savedCallIndex);
  });

  it("invalidates cache for specific org", async () => {
    bindingResult = [{ targetAgentId: "support-agent" }];
    modelConfigResult = [{ modelId: "old-model", temperature: 0.5 }];

    await resolveOrgSlot("org-x", "support");
    invalidateSlotCache("org-x");

    callIndex = 0;
    bindingResult = [{ targetAgentId: "new-support" }];
    modelConfigResult = [{ modelId: "new-model", temperature: 0.9 }];

    const result = await resolveOrgSlot("org-x", "support");
    expect(result.agentId).toBe("new-support");
  });
});
