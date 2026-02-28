/**
 * 需求守护测试：版本 Diff 对比
 *
 * 关联守护规约：.worktree/CAP_GUARD.md
 * 守护能力：FDE 能选择两个版本查看全部 16 种资源类型的差异
 *
 * 覆盖：
 * - Criteria Matrix: AC-2, AC-4, AC-5, AC-6
 * - Constraint Guard: CG-1, CG-3
 * - Degradation Fence: DF-1, DF-2
 */

import { describe, it, expect } from "vitest";
import {
  computeSnapshotDiff,
  buildDiffSummary,
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

function makeTool(key: string, overrides?: Record<string, unknown>) {
  return {
    key,
    name: `Tool-${key}`,
    description: "",
    parametersSchema: null,
    returnParametersSchema: null,
    handler: null,
    url: null,
    componentKey: null,
    enabled: true,
    uiHidden: false,
    executionTarget: "server" as const,
    testCases: [],
    ...overrides,
  };
}

/* ═══════════════════════════════════════
   AC-2: 概览显示 +N ~N -N（标准矩阵）
   ═══════════════════════════════════════ */

describe("[AC-2] buildDiffSummary — 概览计数", () => {
  it("singleton 类别 added 时计数为 added=1", () => {
    const from = makeEmptySnapshot({ chatConfig: null });
    const to = makeEmptySnapshot({
      chatConfig: {
        title: "Hi",
        welcomeTitle: "",
        welcomeIcon: "bot",
        quickActions: [],
        placeholder: "",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const diff = computeSnapshotDiff(from, to);
    const summary = buildDiffSummary(diff);
    const chat = summary.find((s) => s.key === "chatConfig");
    expect(chat).toBeDefined();
    expect(chat!.added).toBe(1);
    expect(chat!.removed).toBe(0);
    expect(chat!.modified).toBe(0);
    expect(chat!.hasChanges).toBe(true);
  });

  it("singleton 类别 removed 时计数为 removed=1", () => {
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
    const summary = buildDiffSummary(diff);
    const mem = summary.find((s) => s.key === "memoryConfig");
    expect(mem).toBeDefined();
    expect(mem!.removed).toBe(1);
    expect(mem!.added).toBe(0);
    expect(mem!.hasChanges).toBe(true);
  });

  it("singleton 类别 modified 时计数为 modified=1", () => {
    const from = makeEmptySnapshot({
      chatConfig: {
        title: "A",
        welcomeTitle: "",
        welcomeIcon: "bot",
        quickActions: [],
        placeholder: "",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const to = makeEmptySnapshot({
      chatConfig: {
        title: "B",
        welcomeTitle: "",
        welcomeIcon: "bot",
        quickActions: [],
        placeholder: "",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const diff = computeSnapshotDiff(from, to);
    const summary = buildDiffSummary(diff);
    const chat = summary.find((s) => s.key === "chatConfig");
    expect(chat!.modified).toBe(1);
    expect(chat!.added).toBe(0);
    expect(chat!.removed).toBe(0);
    expect(chat!.hasChanges).toBe(true);
  });

  it("singleton 类别 unchanged 时 hasChanges=false", () => {
    const config = {
      title: "Same",
      welcomeTitle: "",
      welcomeIcon: "bot",
      quickActions: [],
      placeholder: "",
      suggestions: [],
      enableVoice: false,
      enableAttachment: false,
    };
    const from = makeEmptySnapshot({ chatConfig: config });
    const to = makeEmptySnapshot({ chatConfig: { ...config } });
    const diff = computeSnapshotDiff(from, to);
    const summary = buildDiffSummary(diff);
    const chat = summary.find((s) => s.key === "chatConfig");
    expect(chat!.hasChanges).toBe(false);
    expect(chat!.added).toBe(0);
    expect(chat!.removed).toBe(0);
    expect(chat!.modified).toBe(0);
  });

  it("混合增删改的类别计数全部正确", () => {
    const from = makeEmptySnapshot({
      tools: [
        makeTool("keep", { description: "old" }),
        makeTool("remove"),
      ],
    });
    const to = makeEmptySnapshot({
      tools: [
        makeTool("keep", { description: "new" }),
        makeTool("add"),
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    const summary = buildDiffSummary(diff);
    const tools = summary.find((s) => s.key === "tools");
    expect(tools!.added).toBe(1);
    expect(tools!.removed).toBe(1);
    expect(tools!.modified).toBe(1);
    expect(tools!.hasChanges).toBe(true);
  });
});

/* ═══════════════════════════════════════
   AC-4: 修改资源显示字段变化（标准矩阵）
   ═══════════════════════════════════════ */

describe("[AC-4] computeSnapshotDiff — 字段变化检测", () => {
  it("多字段同时变化全部被检测到", () => {
    const from = makeEmptySnapshot({
      tools: [
        makeTool("t1", {
          description: "old desc",
          enabled: true,
          handler: "fn(){}",
        }),
      ],
    });
    const to = makeEmptySnapshot({
      tools: [
        makeTool("t1", {
          description: "new desc",
          enabled: false,
          handler: "fn2(){}",
        }),
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    const modified = diff.tools.modified;
    expect(modified).toHaveLength(1);
    const changes = modified[0].changes;
    expect(changes.length).toBeGreaterThanOrEqual(3);
    expect(changes.find((c) => c.field === "description")).toBeDefined();
    expect(changes.find((c) => c.field === "enabled")).toBeDefined();
    expect(changes.find((c) => c.field === "handler")).toBeDefined();
  });

  it("嵌套对象变化被检测到", () => {
    const from = makeEmptySnapshot({
      schemas: [
        {
          key: "s1",
          name: "Schema1",
          description: "",
          parameters: { type: "object", properties: { a: { type: "string" } } },
        },
      ],
    });
    const to = makeEmptySnapshot({
      schemas: [
        {
          key: "s1",
          name: "Schema1",
          description: "",
          parameters: { type: "object", properties: { a: { type: "number" } } },
        },
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.schemas.modified).toHaveLength(1);
    const paramChange = diff.schemas.modified[0].changes.find(
      (c) => c.field === "parameters"
    );
    expect(paramChange).toBeDefined();
  });

  it("null → 有值 的变化被检测到", () => {
    const from = makeEmptySnapshot({
      tools: [makeTool("t1", { handler: null })],
    });
    const to = makeEmptySnapshot({
      tools: [makeTool("t1", { handler: "return 42;" })],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.tools.modified).toHaveLength(1);
    const handlerChange = diff.tools.modified[0].changes.find(
      (c) => c.field === "handler"
    );
    expect(handlerChange).toBeDefined();
    expect(handlerChange!.from).toBeNull();
    expect(handlerChange!.to).toBe("return 42;");
  });

  it("有值 → null 的变化被检测到", () => {
    const from = makeEmptySnapshot({
      tools: [makeTool("t1", { url: "https://example.com" })],
    });
    const to = makeEmptySnapshot({
      tools: [makeTool("t1", { url: null })],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.tools.modified).toHaveLength(1);
    const urlChange = diff.tools.modified[0].changes.find(
      (c) => c.field === "url"
    );
    expect(urlChange).toBeDefined();
    expect(urlChange!.from).toBe("https://example.com");
    expect(urlChange!.to).toBeNull();
  });

  it("数组字段变化被检测到", () => {
    const from = makeEmptySnapshot({
      chatConfig: {
        title: "T",
        welcomeTitle: "",
        welcomeIcon: "bot",
        quickActions: ["Q1"],
        placeholder: "",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const to = makeEmptySnapshot({
      chatConfig: {
        title: "T",
        welcomeTitle: "",
        welcomeIcon: "bot",
        quickActions: ["Q1", "Q2"],
        placeholder: "",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.chatConfig.status).toBe("modified");
    const qaChange = diff.chatConfig.changes.find((c) => c.field === "quickActions");
    expect(qaChange).toBeDefined();
  });
});

/* ═══════════════════════════════════════
   AC-5: 无变化标记为 —（标准矩阵）
   ═══════════════════════════════════════ */

describe("[AC-5] buildDiffSummary — 无变化标记", () => {
  it("全部 16 类都无变化时，每个 hasChanges=false", () => {
    const snap = makeEmptySnapshot();
    const diff = computeSnapshotDiff(snap, snap);
    const summary = buildDiffSummary(diff);
    expect(summary).toHaveLength(16);
    for (const cat of summary) {
      expect(cat.hasChanges).toBe(false);
      expect(cat.added).toBe(0);
      expect(cat.removed).toBe(0);
      expect(cat.modified).toBe(0);
    }
  });

  it("只有 1 个类别有变化时，其余 15 个 hasChanges=false", () => {
    const from = makeEmptySnapshot();
    const to = makeEmptySnapshot({
      tools: [makeTool("new-tool")],
    });
    const diff = computeSnapshotDiff(from, to);
    const summary = buildDiffSummary(diff);
    const changed = summary.filter((s) => s.hasChanges);
    const unchanged = summary.filter((s) => !s.hasChanges);
    expect(changed).toHaveLength(1);
    expect(changed[0].key).toBe("tools");
    expect(unchanged).toHaveLength(15);
  });
});

/* ═══════════════════════════════════════
   AC-6: 16 种资源类型全支持（标准矩阵）
   ═══════════════════════════════════════ */

describe("[AC-6] computeSnapshotDiff — 全类型覆盖", () => {
  it("所有 13 种数组类型的添加都被检测到", () => {
    const from = makeEmptySnapshot();
    const to = makeEmptySnapshot({
      tools: [makeTool("t1")],
      functions: [{ key: "f1", name: "F1", description: "", code: "", parametersSchema: null, returnParametersSchema: null, testCases: [] }],
      components: [{ key: "c1", name: "C1", description: "", componentSource: "", generatedCss: "", toolInputSchema: null, componentInputSchema: null, testCases: [] }],
      schemas: [{ key: "s1", name: "S1", description: "", parameters: {} }],
      wikiDocuments: [{ key: "w1", name: "W1", content: "", order: 0, parentKey: null }],
      datasets: [{ key: "d1", name: "D1", description: "", data: {} }],
      modelConfigs: [{ key: "m1", name: "M1", modelId: "test", temperature: 0.7, systemPrompt: "", isActive: false }],
      evalCases: [{ key: "e1", name: "E1", mode: "single" as const, turns: [], expectedOutput: "", tags: [], assertions: [] }],
      judgeConfigs: [{ key: "j1", name: "J1", isActive: false, dimensions: [], promptTemplate: null, turnPromptTemplate: null }],
      objectTypes: [{ key: "ot1", name: "OT1", description: "", icon: "box", color: "#000", schemaKey: null, titleProperty: null, source: "internal" as const, externalConfig: null, order: 0 }],
      objectRelations: [{ key: "or1", name: "OR1", description: "", sourceTypeKey: "ot1", targetTypeKey: "ot1", relationType: "has_many" as const, inverseName: "", order: 0 }],
      mcpServers: [{ key: "mcp1", name: "MCP1", description: "", url: "http://localhost", transportType: "sse" as const, headers: {}, enabled: true }],
      skills: [{ key: "sk1", name: "SK1", description: "", content: "", enabled: true, order: 0 }],
    });
    const diff = computeSnapshotDiff(from, to);

    expect(diff.tools.added).toHaveLength(1);
    expect(diff.functions.added).toHaveLength(1);
    expect(diff.components.added).toHaveLength(1);
    expect(diff.schemas.added).toHaveLength(1);
    expect(diff.wikiDocuments.added).toHaveLength(1);
    expect(diff.datasets.added).toHaveLength(1);
    expect(diff.modelConfigs.added).toHaveLength(1);
    expect(diff.evalCases.added).toHaveLength(1);
    expect(diff.judgeConfigs.added).toHaveLength(1);
    expect(diff.objectTypes.added).toHaveLength(1);
    expect(diff.objectRelations.added).toHaveLength(1);
    expect(diff.mcpServers.added).toHaveLength(1);
    expect(diff.skills.added).toHaveLength(1);
  });

  it("resourceRefs 的添加被检测到", () => {
    const from = makeEmptySnapshot();
    const to = makeEmptySnapshot({
      resourceRefs: [{ resourceType: "tool", resourceKey: "search", enabled: true }],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.resourceRefs.added).toHaveLength(1);
  });

  it("chatConfig 和 memoryConfig 的变化被检测到", () => {
    const from = makeEmptySnapshot();
    const to = makeEmptySnapshot({
      chatConfig: {
        title: "Hi",
        welcomeTitle: "",
        welcomeIcon: "bot",
        quickActions: [],
        placeholder: "",
        suggestions: [],
        enableVoice: false,
        enableAttachment: false,
      },
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
    const diff = computeSnapshotDiff(from, to);
    expect(diff.chatConfig.status).toBe("added");
    expect(diff.memoryConfig.status).toBe("added");
  });

  it("buildDiffSummary 覆盖全部 16 个类别", () => {
    const snap = makeEmptySnapshot();
    const diff = computeSnapshotDiff(snap, snap);
    const summary = buildDiffSummary(diff);
    expect(summary).toHaveLength(16);
    const keys = summary.map((s) => s.key);
    expect(keys).toContain("tools");
    expect(keys).toContain("functions");
    expect(keys).toContain("components");
    expect(keys).toContain("schemas");
    expect(keys).toContain("wikiDocuments");
    expect(keys).toContain("datasets");
    expect(keys).toContain("modelConfigs");
    expect(keys).toContain("chatConfig");
    expect(keys).toContain("memoryConfig");
    expect(keys).toContain("evalCases");
    expect(keys).toContain("judgeConfigs");
    expect(keys).toContain("objectTypes");
    expect(keys).toContain("objectRelations");
    expect(keys).toContain("mcpServers");
    expect(keys).toContain("skills");
    expect(keys).toContain("resourceRefs");
  });
});

/* ═══════════════════════════════════════
   CG-1: 对比是只读操作（约束守卫）
   ═══════════════════════════════════════ */

describe("[CG-1] diff API — 只读约束", () => {
  it("route.ts 仅导出 GET 方法", async () => {
    const routeModule = await import(
      "@/app/api/agents/[id]/versions/diff/route"
    );
    expect(routeModule.GET).toBeDefined();
    expect(typeof routeModule.GET).toBe("function");
    // 确保没有写入方法
    expect(routeModule).not.toHaveProperty("POST");
    expect(routeModule).not.toHaveProperty("PUT");
    expect(routeModule).not.toHaveProperty("DELETE");
    expect(routeModule).not.toHaveProperty("PATCH");
  });
});

/* ═══════════════════════════════════════
   CG-3: 资源通过 key 匹配（约束守卫）
   ═══════════════════════════════════════ */

describe("[CG-3] computeSnapshotDiff — key 匹配", () => {
  it("同 key 不同 name 被识别为修改而非删除+新增", () => {
    const from = makeEmptySnapshot({
      tools: [makeTool("t1", { name: "OldName", description: "same" })],
    });
    const to = makeEmptySnapshot({
      tools: [makeTool("t1", { name: "NewName", description: "same" })],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.tools.added).toHaveLength(0);
    expect(diff.tools.removed).toHaveLength(0);
    expect(diff.tools.modified).toHaveLength(1);
    expect(diff.tools.modified[0].key).toBe("t1");
    const nameChange = diff.tools.modified[0].changes.find(
      (c) => c.field === "name"
    );
    expect(nameChange).toBeDefined();
    expect(nameChange!.from).toBe("OldName");
    expect(nameChange!.to).toBe("NewName");
  });

  it("不同 key 同 name 被识别为删除+新增", () => {
    const from = makeEmptySnapshot({
      tools: [makeTool("key-old", { name: "SameName" })],
    });
    const to = makeEmptySnapshot({
      tools: [makeTool("key-new", { name: "SameName" })],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.tools.added).toHaveLength(1);
    expect(diff.tools.removed).toHaveLength(1);
    expect(diff.tools.modified).toHaveLength(0);
  });

  it("resourceRefs 使用 resourceType:resourceKey 合成 key", () => {
    const from = makeEmptySnapshot({
      resourceRefs: [
        { resourceType: "tool", resourceKey: "search", enabled: true },
      ],
    });
    const to = makeEmptySnapshot({
      resourceRefs: [
        { resourceType: "tool", resourceKey: "search", enabled: false },
      ],
    });
    const diff = computeSnapshotDiff(from, to);
    expect(diff.resourceRefs.added).toHaveLength(0);
    expect(diff.resourceRefs.removed).toHaveLength(0);
    expect(diff.resourceRefs.modified).toHaveLength(1);
    expect(diff.resourceRefs.modified[0].key).toBe("tool:search");
  });
});

/* ═══════════════════════════════════════
   DF-1: 无缓存不影响正确性（退化围栏）
   ═══════════════════════════════════════ */

describe("[DF-1] computeSnapshotDiff — 大量资源 diff 正确", () => {
  it("100 个资源的 diff 仍然正确", () => {
    const fromTools = Array.from({ length: 100 }, (_, i) =>
      makeTool(`t${i}`, { description: `desc-${i}` })
    );
    const toTools = Array.from({ length: 100 }, (_, i) =>
      makeTool(`t${i}`, { description: i < 50 ? `desc-${i}` : `modified-${i}` })
    );
    // 添加 5 个新的，移除前 3 个
    const to = makeEmptySnapshot({
      tools: [
        ...toTools.slice(3),
        ...Array.from({ length: 5 }, (_, i) =>
          makeTool(`new-${i}`)
        ),
      ],
    });
    const from = makeEmptySnapshot({ tools: fromTools });
    const diff = computeSnapshotDiff(from, to);

    expect(diff.tools.added).toHaveLength(5);
    expect(diff.tools.removed).toHaveLength(3);
    // 50 个没改，47 个改了 (index 3-49 没改, 50-99 改了 = 50 个改了)
    expect(diff.tools.modified.length).toBe(50);

    const summary = buildDiffSummary(diff);
    const toolsSummary = summary.find((s) => s.key === "tools");
    expect(toolsSummary!.added).toBe(5);
    expect(toolsSummary!.removed).toBe(3);
    expect(toolsSummary!.modified).toBe(50);
    expect(toolsSummary!.hasChanges).toBe(true);
  });
});

/* ═══════════════════════════════════════
   DF-2: 字段值截断（退化围栏）
   UI 中 formatValue 函数在 80 字符处截断
   ═══════════════════════════════════════ */

describe("[DF-2] formatValue — 超长字段截断", () => {
  // 复制 version-diff-sheet.tsx 中的 formatValue 逻辑作为守护
  function formatValue(val: unknown): string {
    if (val === null || val === undefined) return "null";
    if (typeof val === "string") {
      if (val.length > 80) return `"${val.slice(0, 77)}..."`;
      return `"${val}"`;
    }
    if (typeof val === "boolean" || typeof val === "number") return String(val);
    if (Array.isArray(val)) return `[${val.length} items]`;
    if (typeof val === "object") {
      const keys = Object.keys(val as Record<string, unknown>);
      return `{${keys.length} fields}`;
    }
    return String(val);
  }

  it("80 字符以内的字符串不截断", () => {
    const short = "a".repeat(80);
    expect(formatValue(short)).toBe(`"${short}"`);
  });

  it("超过 80 字符的字符串截断为 77+...", () => {
    const long = "a".repeat(100);
    const result = formatValue(long);
    expect(result).toBe(`"${"a".repeat(77)}..."`);
    // 总长度：1(") + 77 + 3(...) + 1(") = 82
    expect(result.length).toBe(82);
  });

  it("null/undefined 显示为 null", () => {
    expect(formatValue(null)).toBe("null");
    expect(formatValue(undefined)).toBe("null");
  });

  it("数组显示项数", () => {
    expect(formatValue([1, 2, 3])).toBe("[3 items]");
    expect(formatValue([])).toBe("[0 items]");
  });

  it("对象显示字段数", () => {
    expect(formatValue({ a: 1, b: 2 })).toBe("{2 fields}");
    expect(formatValue({})).toBe("{0 fields}");
  });

  it("布尔值和数字直接转字符串", () => {
    expect(formatValue(true)).toBe("true");
    expect(formatValue(false)).toBe("false");
    expect(formatValue(42)).toBe("42");
    expect(formatValue(0)).toBe("0");
  });
});
