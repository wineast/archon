import { z } from "zod";
import type { Dimension, JudgeResult } from "./types";

const DEFAULT_DIMENSIONS: Dimension[] = [
  { key: "overall", label: "Overall", weight: 1 },
];

export function resolveDimensions(dimensions: Dimension[]): Dimension[] {
  return dimensions.length > 0 ? dimensions : DEFAULT_DIMENSIONS;
}

const dimensionScoreSchema = z.object({
  score: z.number().min(1).max(10),
  reason: z.string(),
});

export function buildJudgeSchema(dimensions: Dimension[]) {
  const resolved = resolveDimensions(dimensions);
  const shape: Record<string, typeof dimensionScoreSchema> = {};
  for (const dim of resolved) {
    shape[dim.key] = dimensionScoreSchema;
  }
  return z.object(shape);
}

export function computeOverallScore(
  scores: Record<string, { score: number; reason: string }>,
  dimensions: Dimension[]
): number {
  const resolved = resolveDimensions(dimensions);
  const totalWeight = resolved.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 0;

  let weightedSum = 0;
  for (const dim of resolved) {
    const entry = scores[dim.key];
    if (entry) {
      weightedSum += entry.score * dim.weight;
    }
  }

  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

export function toJudgeResult(
  raw: Record<string, { score: number; reason: string }>,
  dimensions: Dimension[]
): JudgeResult {
  return {
    scores: raw,
    overallScore: computeOverallScore(raw, dimensions),
  };
}
