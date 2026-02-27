import { describe, it, expect } from "vitest";
import { migrateExportData, CURRENT_EXPORT_VERSION } from "../migrations";

function makeV1Export(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    agent: {
      name: "Test Agent",
      description: "desc",
      icon: "bot",
      slug: "test-agent",
      isPublic: false,
      mcpEnabled: false,
      memoryEnabled: false,
      skillsEnabled: false,
      contextCompressionEnabled: false,
    },
    versions: [
      {
        version: "0.1.0",
        changelog: "Initial",
        snapshot: {
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
        },
        isEditing: true,
        isPublished: true,
      },
    ],
    ...overrides,
  };
}

describe("migrateExportData", () => {
  it("returns data unchanged when already at current version", () => {
    const data = { ...makeV1Export(), exportVersion: CURRENT_EXPORT_VERSION, files: [], embedTokens: [] };
    const result = migrateExportData(data);
    expect(result.exportVersion).toBe(CURRENT_EXPORT_VERSION);
  });

  it("upgrades v1 data to current version", () => {
    const data = makeV1Export();
    const result = migrateExportData(data);
    expect(result.exportVersion).toBe(CURRENT_EXPORT_VERSION);
  });

  it("does not mutate the original data", () => {
    const data = makeV1Export();
    migrateExportData(data);
    expect(data.exportVersion).toBe(1);
    expect(data.files).toBeUndefined();
  });
});

describe("migration 0002 — normalize optional fields", () => {
  it("adds ragEnabled default to agent", () => {
    const data = makeV1Export();
    const result = migrateExportData(data);
    const agent = result.agent as Record<string, unknown>;
    expect(agent.ragEnabled).toBe(false);
  });

  it("preserves existing ragEnabled value", () => {
    const data = makeV1Export();
    (data.agent as Record<string, unknown>).ragEnabled = true;
    const result = migrateExportData(data);
    const agent = result.agent as Record<string, unknown>;
    expect(agent.ragEnabled).toBe(true);
  });

  it("adds files and embedTokens defaults", () => {
    const data = makeV1Export();
    expect(data.files).toBeUndefined();
    expect(data.embedTokens).toBeUndefined();
    const result = migrateExportData(data);
    expect(result.files).toEqual([]);
    expect(result.embedTokens).toEqual([]);
  });

  it("preserves existing files array", () => {
    const files = [{ name: "test.pdf", contentType: "application/pdf", size: 100, zipPath: "files/test.pdf" }];
    const data = makeV1Export({ files });
    const result = migrateExportData(data);
    expect(result.files).toEqual(files);
  });

  it("adds uiHidden default to tools", () => {
    const data = makeV1Export();
    const versions = data.versions as Array<Record<string, unknown>>;
    const snapshot = versions[0].snapshot as Record<string, unknown>;
    snapshot.tools = [
      { key: "t1", name: "T1", description: "", enabled: true, executionTarget: "server", testCases: [] },
    ];
    const result = migrateExportData(data);
    const resultVersions = result.versions as Array<Record<string, unknown>>;
    const resultSnapshot = resultVersions[0].snapshot as Record<string, unknown>;
    const resultTools = resultSnapshot.tools as Array<Record<string, unknown>>;
    expect(resultTools[0].uiHidden).toBe(false);
  });

  it("preserves existing uiHidden=true", () => {
    const data = makeV1Export();
    const versions = data.versions as Array<Record<string, unknown>>;
    const snapshot = versions[0].snapshot as Record<string, unknown>;
    snapshot.tools = [
      { key: "t1", name: "T1", description: "", enabled: true, uiHidden: true, executionTarget: "server", testCases: [] },
    ];
    const result = migrateExportData(data);
    const resultVersions = result.versions as Array<Record<string, unknown>>;
    const resultSnapshot = resultVersions[0].snapshot as Record<string, unknown>;
    const resultTools = resultSnapshot.tools as Array<Record<string, unknown>>;
    expect(resultTools[0].uiHidden).toBe(true);
  });

  it("adds assertions default to tool test cases", () => {
    const data = makeV1Export();
    const versions = data.versions as Array<Record<string, unknown>>;
    const snapshot = versions[0].snapshot as Record<string, unknown>;
    snapshot.tools = [
      {
        key: "t1", name: "T1", description: "", enabled: true, executionTarget: "server",
        testCases: [{ name: "tc1", input: {}, expectedOutput: null, tags: [] }],
      },
    ];
    const result = migrateExportData(data);
    const resultVersions = result.versions as Array<Record<string, unknown>>;
    const resultSnapshot = resultVersions[0].snapshot as Record<string, unknown>;
    const resultTools = resultSnapshot.tools as Array<Record<string, unknown>>;
    const testCases = resultTools[0].testCases as Array<Record<string, unknown>>;
    expect(testCases[0].assertions).toEqual([]);
  });

  it("adds scenario default to component test cases", () => {
    const data = makeV1Export();
    const versions = data.versions as Array<Record<string, unknown>>;
    const snapshot = versions[0].snapshot as Record<string, unknown>;
    snapshot.components = [
      {
        key: "c1", name: "C1", description: "", componentSource: "", generatedCss: "",
        testCases: [{ name: "tc1", data: {}, tags: [] }],
      },
    ];
    const result = migrateExportData(data);
    const resultVersions = result.versions as Array<Record<string, unknown>>;
    const resultSnapshot = resultVersions[0].snapshot as Record<string, unknown>;
    const resultComponents = resultSnapshot.components as Array<Record<string, unknown>>;
    const testCases = resultComponents[0].testCases as Array<Record<string, unknown>>;
    expect(testCases[0].scenario).toBe("tool");
  });

  it("adds enableVoice/enableAttachment defaults to chatConfig", () => {
    const data = makeV1Export();
    const versions = data.versions as Array<Record<string, unknown>>;
    const snapshot = versions[0].snapshot as Record<string, unknown>;
    snapshot.chatConfig = {
      title: "T", welcomeTitle: "W", welcomeIcon: "bot",
      quickActions: [], placeholder: "P", suggestions: [],
    };
    const result = migrateExportData(data);
    const resultVersions = result.versions as Array<Record<string, unknown>>;
    const resultSnapshot = resultVersions[0].snapshot as Record<string, unknown>;
    const chatConfig = resultSnapshot.chatConfig as Record<string, unknown>;
    expect(chatConfig.enableVoice).toBe(false);
    expect(chatConfig.enableAttachment).toBe(false);
  });

  it("adds promptTemplate/turnPromptTemplate defaults to judgeConfigs", () => {
    const data = makeV1Export();
    const versions = data.versions as Array<Record<string, unknown>>;
    const snapshot = versions[0].snapshot as Record<string, unknown>;
    snapshot.judgeConfigs = [
      { key: "j1", name: "J1", isActive: true, dimensions: [] },
    ];
    const result = migrateExportData(data);
    const resultVersions = result.versions as Array<Record<string, unknown>>;
    const resultSnapshot = resultVersions[0].snapshot as Record<string, unknown>;
    const judgeConfigs = resultSnapshot.judgeConfigs as Array<Record<string, unknown>>;
    expect(judgeConfigs[0].promptTemplate).toBeNull();
    expect(judgeConfigs[0].turnPromptTemplate).toBeNull();
  });

  it("preserves existing promptTemplate value", () => {
    const data = makeV1Export();
    const versions = data.versions as Array<Record<string, unknown>>;
    const snapshot = versions[0].snapshot as Record<string, unknown>;
    snapshot.judgeConfigs = [
      { key: "j1", name: "J1", isActive: true, dimensions: [], promptTemplate: "custom", turnPromptTemplate: "custom-turn" },
    ];
    const result = migrateExportData(data);
    const resultVersions = result.versions as Array<Record<string, unknown>>;
    const resultSnapshot = resultVersions[0].snapshot as Record<string, unknown>;
    const judgeConfigs = resultSnapshot.judgeConfigs as Array<Record<string, unknown>>;
    expect(judgeConfigs[0].promptTemplate).toBe("custom");
    expect(judgeConfigs[0].turnPromptTemplate).toBe("custom-turn");
  });
});
