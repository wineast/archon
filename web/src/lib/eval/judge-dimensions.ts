import { z } from "zod";
import type { Dimension, JudgeResult } from "./types";

const DEFAULT_DIMENSIONS: Dimension[] = [
  { key: "overall", label: "Overall", weight: 1 },
];

export function resolveDimensions(dimensions: Dimension[]): Dimension[] {
  return dimensions.length > 0 ? dimensions : DEFAULT_DIMENSIONS;
}

function dimensionScoreSchema(min: number, max: number) {
  return z.object({
    score: z.number().min(min).max(max),
    reason: z.string(),
  });
}

export function buildJudgeSchema(dimensions: Dimension[]) {
  const resolved = resolveDimensions(dimensions);
  const shape: Record<string, z.ZodObject<{ score: z.ZodNumber; reason: z.ZodString }>> = {};
  for (const dim of resolved) {
    shape[dim.key] = dimensionScoreSchema(dim.min ?? 1, dim.max ?? 10);
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
