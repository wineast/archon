import type { SchemaProperty } from "@/lib/schemas/types";
import type { Assertion, Dimension, EvalCaseMode, EvalTurn } from "@/lib/eval/types";

/* ─────────── Snapshot Item Types (no id/agentId/createdAt/updatedAt) ─────────── */

export interface ToolSnapshotItem {
  key: string;
  name: string;
  description: string;
  parametersSchemaKey: string | null;
  returnParametersSchemaKey: string | null;
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
  parametersSchemaKey: string | null;
  returnParametersSchemaKey: string | null;
  testCases: FunctionTestCaseSnapshotItem[];
}

export interface ComponentSnapshotItem {
  key: string;
  name: string;
  description: string;
  componentSource: string;
  generatedCss: string;
  testCases: ComponentTestCaseSnapshotItem[];
}

export interface SchemaSnapshotItem {
  key: string;
  name: string;
  description: string;
  parameters: SchemaProperty[];
  includeSchemaKeys?: string[];
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

export interface EvalJudgeConfigSnapshotItem {
  key: string;
  name: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  dimensions: Dimension[];
  isDefault: boolean;
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
  tool: { name: string; input: unknown; output: unknown };
  tags: string[];
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
  evalCases: EvalCaseSnapshotItem[];
  evalJudgeConfigs: EvalJudgeConfigSnapshotItem[];
  objectTypes: ObjectTypeSnapshotItem[];
  objectRelations: ObjectRelationSnapshotItem[];
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
