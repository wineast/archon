import { describe, it, expect } from "vitest";
import type {
  ResourceRefSnapshotItem,
  AgentSnapshot,
} from "../types";

describe("ResourceRefSnapshotItem structure", () => {
  it("serializes to JSON correctly", () => {
    const ref: ResourceRefSnapshotItem = {
      resourceType: "tool",
      resourceKey: "search_web",
      enabled: true,
    };
    const json = JSON.stringify(ref);
    const parsed = JSON.parse(json) as ResourceRefSnapshotItem;
    expect(parsed.resourceType).toBe("tool");
    expect(parsed.resourceKey).toBe("search_web");
    expect(parsed.enabled).toBe(true);
  });

  it("supports all resource types", () => {
    const types = ["tool", "component", "function", "dataset", "wiki", "schema", "mcp-server"] as const;
    for (const type of types) {
      const ref: ResourceRefSnapshotItem = {
        resourceType: type,
        resourceKey: `test_${type}`,
        enabled: false,
      };
      expect(ref.resourceType).toBe(type);
    }
  });
});

describe("AgentSnapshot — resourceRefs field", () => {
  it("includes resourceRefs in snapshot", () => {
    const snapshot: AgentSnapshot = {
      agent: { name: "test", description: "", icon: "bot", slug: "test", isPublic: false },
      tools: [],
      functions: [],
      components: [],
      schemas: [],
      wikiDocuments: [],
      datasets: [],
      modelConfigs: [],
      chatConfig: null,
      memoryConfig: null,
      evalCases: [],
      judgeConfigs: [],
      objectTypes: [],
      objectRelations: [],
      mcpServers: [],
      skills: [],
      resourceRefs: [
        { resourceType: "tool", resourceKey: "search_web", enabled: true },
        { resourceType: "dataset", resourceKey: "faq_data", enabled: false },
      ],
    };
    expect(snapshot.resourceRefs).toHaveLength(2);
    expect(snapshot.resourceRefs[0].resourceKey).toBe("search_web");
    expect(snapshot.resourceRefs[1].enabled).toBe(false);
  });

  it("supports empty resourceRefs array", () => {
    const snapshot: AgentSnapshot = {
      agent: { name: "test", description: "", icon: "bot", slug: "test", isPublic: false },
      tools: [],
      functions: [],
      components: [],
      schemas: [],
      wikiDocuments: [],
      datasets: [],
      modelConfigs: [],
      chatConfig: null,
      memoryConfig: null,
      evalCases: [],
      judgeConfigs: [],
      objectTypes: [],
      objectRelations: [],
      mcpServers: [],
      skills: [],
      resourceRefs: [],
    };
    expect(snapshot.resourceRefs).toHaveLength(0);
  });

  it("old snapshot without resourceRefs is handled safely via optional chaining", () => {
    // Simulate an old snapshot that doesn't have the resourceRefs field
    const oldSnapshot = {
      agent: { name: "test", description: "", icon: "bot", slug: "test", isPublic: false },
      tools: [],
      functions: [],
      components: [],
      schemas: [],
      wikiDocuments: [],
      datasets: [],
      modelConfigs: [],
      chatConfig: null,
      memoryConfig: null,
      evalCases: [],
      judgeConfigs: [],
      objectTypes: [],
      objectRelations: [],
      mcpServers: [],
      skills: [],
      // resourceRefs is missing
    } as unknown as AgentSnapshot;

    // The restoreSnapshot code uses `snapshot.resourceRefs?.length` — verify the pattern works
    const refs = oldSnapshot.resourceRefs;
    expect(refs?.length).toBeFalsy();
  });

  it("JSON round-trip preserves resourceRefs", () => {
    const refs: ResourceRefSnapshotItem[] = [
      { resourceType: "tool", resourceKey: "search_web", enabled: true },
      { resourceType: "mcp-server", resourceKey: "weather_api", enabled: false },
      { resourceType: "function", resourceKey: "calc_tax", enabled: true },
    ];
    const json = JSON.stringify(refs);
    const parsed = JSON.parse(json) as ResourceRefSnapshotItem[];
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ resourceType: "tool", resourceKey: "search_web", enabled: true });
    expect(parsed[1]).toEqual({ resourceType: "mcp-server", resourceKey: "weather_api", enabled: false });
    expect(parsed[2]).toEqual({ resourceType: "function", resourceKey: "calc_tax", enabled: true });
  });
});
