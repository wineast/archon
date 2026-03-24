export type AssertionType =
  | "contains"
  | "not-contains"
  | "regex"
  | "length-min"
  | "length-max"
  | "json-valid"
  | "tool-called"
  | "tool-not-called"
  | "tool-called-with-contains"
  | "tool-called-with-exact";

export interface Assertion {
  id: string;
  type: AssertionType;
  value: string;
}

export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  message: string;
}

export interface AssertionFailConfig {
  judgeOnFail?: boolean; // 案例级断言失败时仍执行 Judge（默认 false）
  judgeTurnOnFail?: boolean; // 多轮单轮断言失败时仍执行该轮 Judge（默认 false）
  stopOnTurnFail?: boolean; // 多轮单轮断言失败时停止后续轮（默认 false）
}

export type EvalCaseMode = "single" | "injected" | "sequential";

/** Tool call attached to an EvalTurn for history injection */
export interface EvalTurnToolCall {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

/** Flattened tool call record extracted from generateText steps */
export interface ToolCallRecord {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface EvalTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  assertions?: Assertion[];
  judge?: boolean;
  expectedOutput?: string;
  toolCalls?: EvalTurnToolCall[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  injected?: boolean;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

export interface TurnResult {
  turnIndex: number;
  role: "user" | "assistant";
  assertionResults?: AssertionResult[];
  judgeResult?: JudgeResult | null;
}

export interface EvalCase {
  id: string;
  key: string;
  name: string;
  mode: EvalCaseMode;
  turns: EvalTurn[];
  assertions: Assertion[];
  expectedOutput: string;
  tags?: string[];
}

export interface Dimension {
  key: string;
  label: string;
  weight: number;
  min?: number;
  max?: number;
}

/** Runtime judge config — assembled from modelConfig + judgeConfig at run time */
export interface RuntimeJudgeConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  dimensions: Dimension[];
}

/** Stored judge config data — scoring dimensions + prompt templates */
export interface JudgeConfigData {
  name: string;
  dimensions: Dimension[];
  promptTemplate?: string | null;
  turnPromptTemplate?: string | null;
}

export interface JudgeResult {
  scores: Record<string, { score: number; reason: string }>;
  overallScore: number;
}

export interface EvalResult {
  caseId: string;
  caseName: string;
  mode: EvalCaseMode;
  turns: EvalTurn[];
  chatMessages: ChatMessage[];
  turnResults: TurnResult[];
  chatResponse: string;
  assertionResults: AssertionResult[];
  allAssertionsPassed: boolean;
  judgeResult: JudgeResult | null;
  timestamp: number;
  durationMs: number;
  error?: string;
}

export interface EvalRunSummary {
  id: string;
  timestamp: number;
  results: EvalResult[];
  totalCases: number;
  passedAssertions: number;
  averageScore: number | null;
}

// ── DB row → runtime type converters ──

import type {
  EvalCaseRow,
  EvalRunRow,
  EvalRunResultRow,
  EvalBatchRow,
} from "@/db/schema";
export type { EvalRunStatus, EvalBatchRow } from "@/db/schema";

export function toEvalCase(row: EvalCaseRow): EvalCase {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    mode: row.mode,
    turns: row.turns,
    assertions: row.assertions,
    expectedOutput: row.expectedOutput ?? "",
    tags: row.tags,
  };
}

export interface EvalRunRequest {
  cases: EvalCase[];
  modelConfigId: string;
  judgeAgentId: string;
  judgeModelConfigId: string;
  judgeConfigId: string;
  templateVars?: Record<string, string>;
  toolNames?: string[];
  filterTags?: string[];
}

export interface EvalRunResponse {
  results: EvalResult[];
  runId: string;
}

// ── New granular API types ──

/** POST /api/eval/run — create a run and start server-side execution */
export interface CreateEvalRunRequest {
  agentId: string;
  /** Optional: when absent, eval runs assertions only (skips judge scoring). */
  judgeAgentId?: string;
  filterTags?: string[];
  assertionFailConfig?: AssertionFailConfig;
  concurrency?: number;
  totalCases: number;
  cases: EvalCase[];
  templateVars?: Record<string, string>;
  toolNames?: string[];
}

export interface CreateEvalRunResponse {
  runId: string;
  chatModel: string;
  status: string;
}

/** POST /api/eval/run/[runId]/case — execute a single case */
export interface RunCaseRequest {
  case: EvalCase;
  templateVars?: Record<string, string>;
  toolNames?: string[];
}

export interface RunCaseResponse {
  result: EvalResult;
}

/** PATCH /api/eval/run/[runId] — finalize run with aggregated stats */
export interface FinalizeRunResponse {
  passedAssertions: number;
  averageScore: number | null;
  totalCases: number;
}

export function toEvalResult(row: EvalRunResultRow): EvalResult {
  return {
    caseId: row.caseId,
    caseName: row.caseName,
    mode: row.mode,
    turns: row.turns,
    chatMessages: row.chatMessages,
    turnResults: row.turnResults,
    chatResponse: row.chatResponse ?? "",
    assertionResults: row.assertionResults,
    allAssertionsPassed: row.allAssertionsPassed,
    judgeResult: row.judgeResult ?? null,
    timestamp: new Date(row.createdAt).getTime(),
    durationMs: row.durationMs,
    error: row.error ?? undefined,
  };
}

export interface EvalRunDetail {
  run: EvalRunRow;
  results: EvalRunResultRow[];
}

// ── Batch types ──

export interface CreateEvalBatchRequest extends CreateEvalRunRequest {
  repeatCount?: number;
  runConcurrency?: number;
}

export interface CreateEvalBatchResponse {
  batchId: string;
  chatModel: string;
  status: string;
}

export interface EvalBatchDetail {
  batch: EvalBatchRow;
  runs: EvalRunRow[];
}

/** Aggregated statistics for N>1 batch display */
export interface BatchAggregatedStats {
  avgPassRate: number;
  avgScore: number | null;
  scoreStdDev: number | null;
  minScore: number | null;
  maxScore: number | null;
  perRunStats: Array<{
    runIndex: number;
    passRate: number;
    averageScore: number | null;
    status: string;
  }>;
}
