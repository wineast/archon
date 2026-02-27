import { describe, it, expect } from "vitest";
import { validateExportData } from "../types";
import { CURRENT_EXPORT_VERSION } from "../migrations";
import type {
  AgentExportData,
  AgentFileSnapshotItem,
  AgentSnapshot,
  ChatConfigSnapshotItem,
  EmbedTokenSnapshotItem,
  MemoryConfigSnapshotItem,
} from "../types";

const MINIMAL_SNAPSHOT: AgentSnapshot = {
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

function makeValidExport(overrides?: Partial<AgentExportData>): AgentExportData {
  return {
    exportVersion: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    agent: {
      name: "Test Agent",
      description: "desc",
      icon: "bot",
      slug: "test-agent",
      isPublic: false,
      mcpEnabled: false,
      memoryEnabled: false,
      ragEnabled: false,
      skillsEnabled: false,
      contextCompressionEnabled: false,
    },
    versions: [
      {
        version: "0.1.0",
        changelog: "Initial",
        snapshot: MINIMAL_SNAPSHOT,
        isEditing: true,
        isPublished: true,
      },
    ],
    files: [],
    embedTokens: [],
    ...overrides,
  };
}

describe("validateExportData", () => {
  it("accepts valid export data", () => {
    expect(validateExportData(makeValidExport())).toBe(true);
  });

  it("accepts export with multiple versions", () => {
    const data = makeValidExport({
      versions: [
        { version: "0.1.0", changelog: "v1", snapshot: MINIMAL_SNAPSHOT, isEditing: false, isPublished: false },
        { version: "0.2.0", changelog: "v2", snapshot: MINIMAL_SNAPSHOT, isEditing: true, isPublished: true },
      ],
    });
    expect(validateExportData(data)).toBe(true);
  });

  it("rejects null", () => {
    expect(validateExportData(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(validateExportData("string")).toBe(false);
    expect(validateExportData(42)).toBe(false);
  });

  it("rejects missing exportVersion", () => {
    const data = makeValidExport();
    const { exportVersion, ...rest } = data;
    expect(validateExportData(rest)).toBe(false);
  });

  it("rejects exportVersion higher than current", () => {
    expect(validateExportData({ ...makeValidExport(), exportVersion: CURRENT_EXPORT_VERSION + 1 })).toBe(false);
  });

  it("rejects exportVersion 0", () => {
    expect(validateExportData({ ...makeValidExport(), exportVersion: 0 })).toBe(false);
  });

  it("rejects non-number exportVersion", () => {
    expect(validateExportData({ ...makeValidExport(), exportVersion: "1" })).toBe(false);
  });

  it("accepts exportVersion 1 (old format)", () => {
    expect(validateExportData({ ...makeValidExport(), exportVersion: 1 })).toBe(true);
  });

  it("rejects missing agent", () => {
    const { agent, ...rest } = makeValidExport();
    expect(validateExportData(rest)).toBe(false);
  });

  it("rejects agent with empty name", () => {
    const data = makeValidExport();
    data.agent.name = "   ";
    expect(validateExportData(data)).toBe(false);
  });

  it("rejects agent with non-string name", () => {
    const data = makeValidExport() as unknown as Record<string, unknown>;
    (data.agent as Record<string, unknown>).name = 123;
    expect(validateExportData(data)).toBe(false);
  });

  it("rejects missing versions", () => {
    const { versions, ...rest } = makeValidExport();
    expect(validateExportData(rest)).toBe(false);
  });

  it("rejects empty versions array", () => {
    expect(validateExportData(makeValidExport({ versions: [] }))).toBe(false);
  });

  it("rejects versions as non-array", () => {
    expect(validateExportData({ ...makeValidExport(), versions: "not-array" })).toBe(false);
  });

  it("accepts export with empty files array", () => {
    const data = makeValidExport();
    expect(data.files).toEqual([]);
    expect(validateExportData(data)).toBe(true);
  });

  it("accepts export with valid files array", () => {
    const files: AgentFileSnapshotItem[] = [
      { name: "rate-sheet.pdf", contentType: "application/pdf", size: 1024, zipPath: "files/rate-sheet.pdf" },
    ];
    expect(validateExportData(makeValidExport({ files }))).toBe(true);
  });

  it("rejects files as non-array", () => {
    expect(validateExportData({ ...makeValidExport(), files: "not-array" })).toBe(false);
  });
});

describe("AgentExportData — agent metadata fields", () => {
  it("includes contextCompressionEnabled", () => {
    const data = makeValidExport();
    expect(data.agent.contextCompressionEnabled).toBe(false);
  });
});

describe("ChatConfigSnapshotItem — enableVoice/enableAttachment", () => {
  it("includes enableVoice and enableAttachment fields", () => {
    const chatConfig: ChatConfigSnapshotItem = {
      title: "Test",
      welcomeTitle: "Hello",
      welcomeIcon: "bot",
      quickActions: [],
      placeholder: "Ask...",
      suggestions: [],
      enableVoice: true,
      enableAttachment: false,
    };
    expect(chatConfig.enableVoice).toBe(true);
    expect(chatConfig.enableAttachment).toBe(false);
  });

  it("snapshot with chatConfig preserves new fields via JSON round-trip", () => {
    const snapshot: AgentSnapshot = {
      ...MINIMAL_SNAPSHOT,
      chatConfig: {
        title: "T",
        welcomeTitle: "W",
        welcomeIcon: "bot",
        quickActions: ["q1"],
        placeholder: "P",
        suggestions: ["s1"],
        enableVoice: true,
        enableAttachment: true,
      },
    };
    const parsed = JSON.parse(JSON.stringify(snapshot)) as AgentSnapshot;
    expect(parsed.chatConfig?.enableVoice).toBe(true);
    expect(parsed.chatConfig?.enableAttachment).toBe(true);
  });
});

describe("MemoryConfigSnapshotItem", () => {
  it("has all required fields", () => {
    const config: MemoryConfigSnapshotItem = {
      autoExtract: true,
      extractionPrompt: "Extract key info",
      maxMemoriesPerUser: 50,
      maxGlobalMemories: 500,
      injectionMode: "system_prompt",
      maxInjectedMemories: 5,
      decayEnabled: true,
      decayDays: 30,
      memoryTypeDefs: [{ key: "preference", description: "User prefs" }],
    };
    expect(config.autoExtract).toBe(true);
    expect(config.injectionMode).toBe("system_prompt");
    expect(config.memoryTypeDefs).toHaveLength(1);
  });

  it("snapshot with memoryConfig preserves data via JSON round-trip", () => {
    const snapshot: AgentSnapshot = {
      ...MINIMAL_SNAPSHOT,
      memoryConfig: {
        autoExtract: false,
        extractionPrompt: "",
        maxMemoriesPerUser: 100,
        maxGlobalMemories: 1000,
        injectionMode: "context",
        maxInjectedMemories: 10,
        decayEnabled: false,
        decayDays: 90,
        memoryTypeDefs: [],
      },
    };
    const parsed = JSON.parse(JSON.stringify(snapshot)) as AgentSnapshot;
    expect(parsed.memoryConfig).not.toBeNull();
    expect(parsed.memoryConfig?.injectionMode).toBe("context");
    expect(parsed.memoryConfig?.maxGlobalMemories).toBe(1000);
  });

  it("snapshot with null memoryConfig is valid", () => {
    expect(MINIMAL_SNAPSHOT.memoryConfig).toBeNull();
  });
});

describe("EmbedTokenSnapshotItem", () => {
  it("accepts export with embedTokens", () => {
    const tokens: EmbedTokenSnapshotItem[] = [
      { name: "Dev Token", allowedOrigins: ["http://localhost:3000"], isActive: true },
    ];
    const data = makeValidExport({ embedTokens: tokens });
    expect(validateExportData(data)).toBe(true);
    expect(data.embedTokens).toHaveLength(1);
    expect(data.embedTokens[0].name).toBe("Dev Token");
  });

  it("accepts export with empty embedTokens", () => {
    const data = makeValidExport();
    expect(data.embedTokens).toEqual([]);
    expect(validateExportData(data)).toBe(true);
  });

  it("preserves embedTokens via JSON round-trip", () => {
    const tokens: EmbedTokenSnapshotItem[] = [
      { name: "Token A", allowedOrigins: [], isActive: true },
      { name: "Token B", allowedOrigins: ["https://example.com"], isActive: false },
    ];
    const data = makeValidExport({ embedTokens: tokens });
    const parsed = JSON.parse(JSON.stringify(data)) as AgentExportData;
    expect(parsed.embedTokens).toHaveLength(2);
    expect(parsed.embedTokens[0].name).toBe("Token A");
    expect(parsed.embedTokens[1].allowedOrigins).toEqual(["https://example.com"]);
    expect(parsed.embedTokens[1].isActive).toBe(false);
  });
});
