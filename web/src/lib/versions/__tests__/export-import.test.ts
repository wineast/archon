import { describe, it, expect } from "vitest";
import { validateExportData } from "../types";
import type { AgentExportData, AgentSnapshot } from "../types";

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
  evalCases: [],
  evalJudgeConfigs: [],
  objectTypes: [],
  objectRelations: [],
  mcpServers: [],
  skills: [],
};

function makeValidExport(overrides?: Partial<AgentExportData>): AgentExportData {
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

  it("rejects wrong exportVersion", () => {
    expect(validateExportData({ ...makeValidExport(), exportVersion: 2 })).toBe(false);
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
});
