import { describe, it, expect, vi, beforeEach } from "vitest";

// Configurable results per-call
let agentsResult: unknown[] = [];
let modelConfigsResult: unknown[] = [];
let callIndex = 0;

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            // First call in getBuiltinAgentConfig is for agents, second is for modelConfigs
            const idx = callIndex++;
            return idx % 2 === 0 ? agentsResult : modelConfigsResult;
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: { id: "id", orgId: "orgId", slug: "slug" },
  modelConfigs: { agentId: "agentId", modelId: "modelId", temperature: "temperature", isActive: "isActive" },
}));

import { getBuiltinAgentConfig, invalidateBuiltinAgentConfigCache } from "../get-config";

describe("getBuiltinAgentConfig", () => {
  beforeEach(() => {
    invalidateBuiltinAgentConfigCache();
    agentsResult = [];
    modelConfigsResult = [];
    callIndex = 0;
  });

  it("returns defaults when agent does not exist", async () => {
    agentsResult = [];

    const config = await getBuiltinAgentConfig("org-1", "build-chat");
    expect(config.model).toBe("anthropic/claude-sonnet-4");
    expect(config.temperature).toBe(0.3);
    expect(config.agentId).toBe("");
  });

  it("returns defaults when agent exists but no active config", async () => {
    agentsResult = [{ id: "agent-1" }];
    modelConfigsResult = [];

    const config = await getBuiltinAgentConfig("org-2", "assist");
    expect(config.model).toBe("anthropic/claude-sonnet-4");
    expect(config.temperature).toBe(0.7);
    expect(config.agentId).toBe("agent-1");
  });

  it("returns active config values", async () => {
    agentsResult = [{ id: "agent-1" }];
    modelConfigsResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    const config = await getBuiltinAgentConfig("org-3", "build-chat");
    expect(config.model).toBe("openai/gpt-4o");
    expect(config.temperature).toBe(0.5);
  });

  it("caches results", async () => {
    agentsResult = [{ id: "agent-1" }];
    modelConfigsResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    const config1 = await getBuiltinAgentConfig("org-4", "build-chat");
    modelConfigsResult = [{ modelId: "changed-model", temperature: 1.0 }];
    callIndex = 0; // Reset
    const config2 = await getBuiltinAgentConfig("org-4", "build-chat");

    // Should return cached value
    expect(config2.model).toBe(config1.model);
  });

  it("invalidates cache", async () => {
    agentsResult = [{ id: "agent-1" }];
    modelConfigsResult = [{ modelId: "openai/gpt-4o", temperature: 0.5 }];

    await getBuiltinAgentConfig("org-5", "build-chat");
    invalidateBuiltinAgentConfigCache("org-5");

    callIndex = 0;
    modelConfigsResult = [{ modelId: "changed-model", temperature: 1.0 }];
    const config = await getBuiltinAgentConfig("org-5", "build-chat");
    expect(config.model).toBe("changed-model");
  });
});
