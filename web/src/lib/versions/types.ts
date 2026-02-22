import type { JsonSchema7 } from "@/lib/schemas/types";
import type { Assertion, Dimension, EvalCaseMode, EvalTurn } from "@/lib/eval/types";
import type { AgentScope, MemoryTypeDef, ResourceType } from "@/db/schema";

/* ─────────── Snapshot Item Types (no id/agentId/createdAt/updatedAt) ─────────── */

export interface ToolSnapshotItem {
  key: string;
  name: string;
  description: string;
  parametersSchema: JsonSchema7 | null;
  returnParametersSchema: JsonSchema7 | null;
  handler: string | null;
  url: string | null;
  componentKey: string | null;
  enabled: boolean;
  executionTarget: "server" | "client" | "host";
  testCases: ToolTestCaseSnapshotItem[];
}

export interface FunctionSnapshotItem {
  key: string;
  name: string;
  description: string;
  code: string;
  parametersSchema: JsonSchema7 | null;
  returnParametersSchema: JsonSchema7 | null;
  testCases: FunctionTestCaseSnapshotItem[];
}

export interface ComponentSnapshotItem {
  key: string;
  name: string;
  description: string;
  componentSource: string;
  generatedCss: string;
  toolInputSchema: JsonSchema7 | null;
  componentInputSchema: JsonSchema7 | null;
  testCases: ComponentTestCaseSnapshotItem[];
}

export interface SchemaSnapshotItem {
  key: string;
  name: string;
  description: string;
  parameters: JsonSchema7;
}

export interface WikiDocumentSnapshotItem {
  key: string;
  name: string;
  content: string;
  order: number;
  parentKey: string | null;
}

export interface DatasetSnapshotItem {
  key: string;
  name: string;
  description: string;
  data: unknown;
}

export interface ModelConfigSnapshotItem {
  key: string;
  name: string;
  modelId: string;
  systemPrompt: string;
  temperature: number;
  isActive: boolean;
}

export interface ChatConfigSnapshotItem {
  title: string;
  welcomeTitle: string;
  welcomeIcon: string;
  quickActions: string[];
  placeholder: string;
  suggestions: string[];
  enableVoice: boolean;
  enableAttachment: boolean;
}

export interface MemoryConfigSnapshotItem {
  autoExtract: boolean;
  extractionPrompt: string;
  maxMemoriesPerUser: number;
  maxGlobalMemories: number;
  injectionMode: "system_prompt" | "context" | "none";
  maxInjectedMemories: number;
  decayEnabled: boolean;
  decayDays: number;
  memoryTypeDefs: MemoryTypeDef[];
}

export interface EvalCaseSnapshotItem {
  key: string;
  name: string;
  mode: EvalCaseMode;
  turns: EvalTurn[];
  expectedOutput: string | null;
  assertions: Assertion[];
  tags: string[];
}

export interface JudgeConfigSnapshotItem {
  key: string;
  name: string;
  isActive: boolean;
  dimensions: Dimension[];
}

/* ─────────── Test Case Snapshot Items ─────────── */

export interface ToolTestCaseSnapshotItem {
  name: string;
  input: Record<string, unknown>;
  expectedOutput: unknown;
  tags: string[];
}

export interface FunctionTestCaseSnapshotItem {
  name: string;
  input: Record<string, unknown>;
  expectedOutput: unknown;
  tags: string[];
}

export interface ComponentTestCaseSnapshotItem {
  name: string;
  data: unknown;
  tags: string[];
  scenario: "tool" | "component";
}

/* ─────────── Ontology Snapshot Items ─────────── */

export interface ObjectTypeSnapshotItem {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  schemaKey: string | null;
  titleProperty: string | null;
  source: "internal" | "external";
  externalConfig: Record<string, unknown> | null;
  order: number;
}

export interface ObjectRelationSnapshotItem {
  key: string;
  name: string;
  description: string;
  sourceTypeKey: string;
  targetTypeKey: string;
  relationType: "has_one" | "has_many" | "belongs_to" | "many_to_many";
  inverseName: string;
  order: number;
}

/* ─────────── MCP Server Snapshot Items ─────────── */

export interface McpServerSnapshotItem {
  key: string;
  name: string;
  description: string;
  url: string;
  transportType: "sse" | "http";
  headers: Record<string, string>;
  enabled: boolean;
}

/* ─────────── Skill Snapshot Items ─────────── */

export interface SkillSnapshotItem {
  key: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  order: number;
}

/* ─────────── Resource Ref Snapshot Items ─────────── */

export interface ResourceRefSnapshotItem {
  resourceType: ResourceType;
  resourceKey: string;
  enabled: boolean;
}

/* ─────────── Agent Snapshot ─────────── */

export interface AgentSnapshot {
  agent: {
    name: string;
    description: string;
    icon: string;
    slug: string;
    isPublic: boolean;
  };
  tools: ToolSnapshotItem[];
  functions: FunctionSnapshotItem[];
  components: ComponentSnapshotItem[];
  schemas: SchemaSnapshotItem[];
  wikiDocuments: WikiDocumentSnapshotItem[];
  datasets: DatasetSnapshotItem[];
  modelConfigs: ModelConfigSnapshotItem[];
  chatConfig: ChatConfigSnapshotItem | null;
  memoryConfig: MemoryConfigSnapshotItem | null;
  evalCases: EvalCaseSnapshotItem[];
  judgeConfigs: JudgeConfigSnapshotItem[];
  objectTypes: ObjectTypeSnapshotItem[];
  objectRelations: ObjectRelationSnapshotItem[];
  mcpServers: McpServerSnapshotItem[];
  skills: SkillSnapshotItem[];
  resourceRefs: ResourceRefSnapshotItem[];
}

/* ─────────── Version List Item (without snapshot) ─────────── */

export interface VersionListItem {
  id: string;
  agentId: string;
  version: string;
  changelog: string;
  createdBy: string | null;
  createdAt: string;
  creatorNickname?: string | null;
  creatorEmail?: string | null;
}

/* ─────────── Version Detail (with snapshot) ─────────── */

export interface VersionDetail extends VersionListItem {
  snapshot: AgentSnapshot;
}

/* ─────────── Agent Export/Import ─────────── */

export interface AgentExportVersion {
  version: string;
  changelog: string;
  snapshot: AgentSnapshot;
  isEditing: boolean;
  isPublished: boolean;
}

export interface AgentExportData {
  exportVersion: 1;
  exportedAt: string;
  agent: {
    name: string;
    description: string;
    icon: string;
    slug: string;
    isPublic: boolean;
    mcpEnabled: boolean;
    memoryEnabled: boolean;
    skillsEnabled: boolean;
    contextCompressionEnabled: boolean;
    scope: AgentScope;
  };
  versions: AgentExportVersion[];
}

/** Validate that the given value is a valid AgentExportData shape. */
export function validateExportData(
  data: unknown
): data is AgentExportData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.exportVersion !== 1) return false;
  if (typeof d.agent !== "object" || d.agent === null) return false;
  const agent = d.agent as Record<string, unknown>;
  if (typeof agent.name !== "string" || !agent.name.trim()) return false;
  if (!Array.isArray(d.versions) || d.versions.length === 0) return false;
  return true;
}
