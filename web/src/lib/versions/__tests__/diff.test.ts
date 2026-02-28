import { describe, it, expect } from "vitest";
import {
  computeSnapshotDiff,
  buildDiffSummary,
  type SnapshotDiff,
  type ResourceCategoryDiff,
  type SingletonDiff,
} from "../diff";
import type { AgentSnapshot } from "../types";

/* ─────────── Helpers ─────────── */

function makeEmptySnapshot(
  overrides?: Partial<AgentSnapshot>
): AgentSnapshot {
  return {
    agent: {
      name: "Test Agent",
      description: "",
      icon: "bot",
      slug: "test-agent",
      isPublic: false,
    },
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
    ...overrides,
  };
}

/* ─────────── Tests ─────────── */

describe("computeSnapshotDiff", () => {
  it("returns no changes for identical snapshots", () => {
    const snap = makeEmptySnapshot({
      tools: [
        {
          key: "t1",
          name: "Tool1",
          description: "desc",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: null,
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [],
        },
      ],
    });
    const diff = computeSnapshotDiff(snap, snap);
    expect(diff.tools.added).toHaveLength(0);
    expect(diff.tools.removed).toHaveLength(0);
    expect(diff.tools.modified).toHaveLength(0);
  });

  it("detects added resources", () => {
    const from = makeEmptySnapshot();
    const to = makeEmptySnapshot({
      tools: [
        {
          key: "t1",
          name: "NewTool",
          description: "",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: null,
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [],
        },
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.tools.added).toHaveLength(1);
    expect(diff.tools.added[0].name).toBe("NewTool");
    expect(diff.tools.removed).toHaveLength(0);
    expect(diff.tools.modified).toHaveLength(0);
  });

  it("detects removed resources", () => {
    const from = makeEmptySnapshot({
      functions: [
        {
          key: "f1",
          name: "OldFunc",
          description: "",
          code: "return 1",
          parametersSchema: null,
          returnParametersSchema: null,
          testCases: [],
        },
      ],
    });
    const to = makeEmptySnapshot();
    const diff = computeSnapshotDiff(from, to);
    expect(diff.functions.removed).toHaveLength(1);
    expect(diff.functions.removed[0].name).toBe("OldFunc");
    expect(diff.functions.added).toHaveLength(0);
  });

  it("detects modified resources with field changes", () => {
    const from = makeEmptySnapshot({
      schemas: [
        {
          key: "s1",
          name: "Schema1",
          description: "old desc",
          parameters: { type: "object" },
        },
      ],
    });
    const to = makeEmptySnapshot({
      schemas: [
        {
          key: "s1",
          name: "Schema1",
          description: "new desc",
          parameters: { type: "object", properties: {} },
        },
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.schemas.modified).toHaveLength(1);
    expect(diff.schemas.modified[0].key).toBe("s1");

    const changes = diff.schemas.modified[0].changes;
    const descChange = changes.find((c) => c.field === "description");
    expect(descChange).toBeDefined();
    expect(descChange!.from).toBe("old desc");
    expect(descChange!.to).toBe("new desc");

    const paramChange = changes.find((c) => c.field === "parameters");
    expect(paramChange).toBeDefined();
  });

  it("handles singleton added", () => {
    const from = makeEmptySnapshot({ chatConfig: null });
    const to = makeEmptySnapshot({
      chatConfig: {
        title: "Hello",
        welcomeTitle: "Welcome",
        welcomeIcon: "bot",
        quickActions: [],
        placeholder: "Ask me...",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.chatConfig.status).toBe("added");
  });

  it("handles singleton removed", () => {
    const from = makeEmptySnapshot({
      memoryConfig: {
        autoExtract: true,
        extractionPrompt: "",
        maxMemoriesPerUser: 100,
        maxGlobalMemories: 1000,
        injectionMode: "system_prompt" as const,
        maxInjectedMemories: 10,
        decayEnabled: false,
        decayDays: 30,
        memoryTypeDefs: [],
      },
    });
    const to = makeEmptySnapshot({ memoryConfig: null });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.memoryConfig.status).toBe("removed");
  });

  it("handles singleton modified", () => {
    const from = makeEmptySnapshot({
      chatConfig: {
        title: "Old title",
        welcomeTitle: "Welcome",
        welcomeIcon: "bot",
        quickActions: [],
        placeholder: "Ask me...",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const to = makeEmptySnapshot({
      chatConfig: {
        title: "New title",
        welcomeTitle: "Welcome",
        welcomeIcon: "bot",
        quickActions: [],
        placeholder: "Ask me...",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.chatConfig.status).toBe("modified");
    expect(diff.chatConfig.changes).toHaveLength(1);
    expect(diff.chatConfig.changes[0].field).toBe("title");
  });

  it("handles resourceRefs by synthesized key", () => {
    const from = makeEmptySnapshot({
      resourceRefs: [
        { resourceType: "tool", resourceKey: "search", enabled: true },
      ],
    });
    const to = makeEmptySnapshot({
      resourceRefs: [
        { resourceType: "tool", resourceKey: "search", enabled: false },
        { resourceType: "component", resourceKey: "badge", enabled: true },
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.resourceRefs.added).toHaveLength(1);
    expect(diff.resourceRefs.added[0].name).toBe("component:badge");
    expect(diff.resourceRefs.modified).toHaveLength(1);
    expect(diff.resourceRefs.modified[0].changes[0].field).toBe("enabled");
  });

  it("skips testCases field in comparison", () => {
    const from = makeEmptySnapshot({
      tools: [
        {
          key: "t1",
          name: "Tool1",
          description: "desc",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: "fn(){}",
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [],
        },
      ],
    });
    const to = makeEmptySnapshot({
      tools: [
        {
          key: "t1",
          name: "Tool1",
          description: "desc",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: "fn(){}",
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [
            {
              name: "test",
              input: {},
              expectedOutput: "{}",
              tags: [],
              assertions: [],
            },
          ],
        },
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    // testCases should be skipped, so no modification detected
    expect(diff.tools.modified).toHaveLength(0);
  });
});

describe("buildDiffSummary", () => {
  it("produces correct summary counts", () => {
    const from = makeEmptySnapshot({
      tools: [
        {
          key: "t1",
          name: "Tool1",
          description: "a",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: null,
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [],
        },
        {
          key: "t2",
          name: "Tool2",
          description: "b",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: null,
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [],
        },
      ],
    });
    const to = makeEmptySnapshot({
      tools: [
        {
          key: "t1",
          name: "Tool1",
          description: "a-modified",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: null,
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [],
        },
        {
          key: "t3",
          name: "Tool3",
          description: "c",
          parametersSchema: null,
          returnParametersSchema: null,
          handler: null,
          url: null,
          componentKey: null,
          enabled: true,
          uiHidden: false,
          executionTarget: "server",
          testCases: [],
        },
      ],
    });

    const diff = computeSnapshotDiff(from, to);
    const summary = buildDiffSummary(diff);

    const toolsSummary = summary.find((s) => s.key === "tools");
    expect(toolsSummary).toBeDefined();
    expect(toolsSummary!.added).toBe(1); // t3 added
    expect(toolsSummary!.removed).toBe(1); // t2 removed
    expect(toolsSummary!.modified).toBe(1); // t1 modified
    expect(toolsSummary!.hasChanges).toBe(true);
  });

  it("marks categories with no changes as hasChanges=false", () => {
    const snap = makeEmptySnapshot();
    const diff = computeSnapshotDiff(snap, snap);
    const summary = buildDiffSummary(diff);

    for (const cat of summary) {
      expect(cat.hasChanges).toBe(false);
    }
  });

  it("covers all 16 categories", () => {
    const snap = makeEmptySnapshot();
    const diff = computeSnapshotDiff(snap, snap);
    const summary = buildDiffSummary(diff);
    expect(summary).toHaveLength(16);
  });
});
