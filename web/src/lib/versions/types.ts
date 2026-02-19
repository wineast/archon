import type { ToolParameter } from "@/lib/tools/types";
import type { Assertion, Dimension } from "@/lib/eval/types";

/* ─────────── Snapshot Item Types (no id/agentId/createdAt/updatedAt) ─────────── */

export interface ToolSnapshotItem {
  key: string;
  name: string;
  description: string;
  parametersSchemaKey: string | null;
  returnParametersSchemaKey: string | null;
  output: string | null;
  handler: string | null;
  component: string | null;
  componentSource: string | null;
  enabled: boolean;
  executionTarget: "server" | "client" | "host";
  testCases: ToolTestCaseSnapshotItem[];
}

export interface FunctionSnapshotItem {
  key: string;
  name: string;
  description: string;
  code: string;
  parameters: ToolParameter[];
  returnParameters: ToolParameter[];
  testCases: FunctionTestCaseSnapshotItem[];
}

export interface ComponentSnapshotItem {
  key: string;
  name: string;
  description: string;
  componentSource: string;
  inputSchemaKey: string | null;
  outputSchemaKey: string | null;
  generatedCss: string;
  testCases: ComponentTestCaseSnapshotItem[];
}

export interface SchemaSnapshotItem {
  key: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface WikiDocumentSnapshotItem {
  key: string;
  title: string;
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
  input: string;
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
