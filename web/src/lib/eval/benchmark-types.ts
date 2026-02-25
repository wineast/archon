export interface TrendPoint {
  runId: string;
  createdAt: string;
  chatModel: string;
  averageScore: number | null;
  passRate: number;
  averageLatencyMs: number | null;
  totalCases: number;
  isBaseline: boolean;
  scoreMax: number;
}

export interface CaseComparison {
  caseId: string;
  caseName: string;
  resultA: {
    score: number | null;
    passed: boolean;
    latencyMs: number;
  } | null;
  resultB: {
    score: number | null;
    passed: boolean;
    latencyMs: number;
  } | null;
  scoreDelta: number | null;
  latencyDelta: number | null;
  passedChanged: boolean;
}

export interface CompareSummary {
  scoreAvgA: number | null;
  scoreAvgB: number | null;
  passRateA: number;
  passRateB: number;
  latencyAvgA: number | null;
  latencyAvgB: number | null;
  winner: "A" | "B" | "tie";
}

export interface CompareRunMeta {
  id: string;
  chatModel: string;
  createdAt: string;
  totalCases: number;
}

export interface CompareResponse {
  runA: CompareRunMeta;
  runB: CompareRunMeta;
  cases: CaseComparison[];
  summary: CompareSummary;
}

export interface ModelStats {
  chatModel: string;
  runCount: number;
  avgScore: number | null;
  avgPassRate: number;
  avgLatencyMs: number | null;
  lastRunAt: string;
}
