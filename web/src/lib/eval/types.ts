export type AssertionType =
  | "contains"
  | "not-contains"
  | "regex"
  | "length-min"
  | "length-max"
  | "json-valid";

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

export interface EvalCase {
  id: string;
  key: string;
  name: string;
  input: string;
  assertions: Assertion[];
  expectedOutput: string;
  tags?: string[];
}

export interface Dimension {
  key: string;
  label: string;
  weight: number;
}

export interface JudgeConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  dimensions: Dimension[];
}

export interface JudgeResult {
  scores: Record<string, { score: number; reason: string }>;
  overallScore: number;
}

export interface EvalResult {
  caseId: string;
  caseName: string;
  input: string;
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

import type { EvalCaseRow, EvalJudgeConfigRow, EvalRunRow, EvalRunResultRow } from "@/db/schema";

export function toEvalCase(row: EvalCaseRow): EvalCase {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    input: row.input,
    assertions: row.assertions,
    expectedOutput: row.expectedOutput ?? "",
    tags: row.tags,
  };
}

export function toJudgeConfig(row: EvalJudgeConfigRow): JudgeConfig {
  return {
    systemPrompt: row.systemPrompt,
    model: row.model,
    temperature: row.temperature,
    dimensions: row.dimensions,
  };
}

export interface EvalRunRequest {
  cases: EvalCase[];
  judgeConfig: JudgeConfig;
  modelConfigId: string;
  templateVars?: Record<string, string>;
  toolNames?: string[];
  judgeConfigId?: string;
  filterTags?: string[];
}

export interface EvalRunResponse {
  results: EvalResult[];
  runId: string;
}

// ── New granular API types ──

/** POST /api/eval/run — create a run record only */
export interface CreateEvalRunRequest {
  modelConfigId: string;
  judgeConfigId?: string;
  judgeConfigName: string;
  filterTags?: string[];
  totalCases: number;
}

export interface CreateEvalRunResponse {
  runId: string;
}

/** POST /api/eval/run/[runId]/case — execute a single case */
export interface RunCaseRequest {
  case: EvalCase;
  judgeConfig: JudgeConfig;
  modelConfigId: string;
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
    input: row.input,
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
