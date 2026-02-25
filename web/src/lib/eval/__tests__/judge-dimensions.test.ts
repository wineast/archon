import { describe, it, expect } from "vitest";
import {
  resolveDimensions,
  buildJudgeSchema,
  computeOverallScore,
  toJudgeResult,
  getScoreMax,
} from "../judge-dimensions";
import type { Dimension } from "../types";

describe("resolveDimensions", () => {
  it("returns default [overall] dimension when empty", () => {
    const result = resolveDimensions([]);
    expect(result).toEqual([{ key: "overall", label: "Overall", weight: 1 }]);
  });

  it("returns the provided dimensions when non-empty", () => {
    const dims: Dimension[] = [
      { key: "accuracy", label: "Accuracy", weight: 0.5 },
      { key: "tone", label: "Tone", weight: 0.5 },
    ];
    expect(resolveDimensions(dims)).toBe(dims);
  });
});

describe("buildJudgeSchema", () => {
  it("builds schema with default dimension for empty array", () => {
    const schema = buildJudgeSchema([]);
    const valid = { overall: { score: 8, reason: "good" } };
    expect(schema.parse(valid)).toEqual(valid);
  });

  it("builds schema with custom dimensions", () => {
    const dims: Dimension[] = [
      { key: "accuracy", label: "Accuracy", weight: 0.6 },
      { key: "completeness", label: "Completeness", weight: 0.4 },
    ];
    const schema = buildJudgeSchema(dims);

    const valid = {
      accuracy: { score: 9, reason: "correct" },
      completeness: { score: 7, reason: "some gaps" },
    };
    expect(schema.parse(valid)).toEqual(valid);
  });

  it("rejects score outside 1-10 range", () => {
    const schema = buildJudgeSchema([]);
    expect(() => schema.parse({ overall: { score: 0, reason: "bad" } })).toThrow();
    expect(() => schema.parse({ overall: { score: 11, reason: "bad" } })).toThrow();
  });

  it("respects custom min/max on dimensions", () => {
    const dims: Dimension[] = [
      { key: "pass", label: "Pass", weight: 1, min: 0, max: 1 },
    ];
    const schema = buildJudgeSchema(dims);

    expect(schema.parse({ pass: { score: 0, reason: "fail" } })).toEqual({
      pass: { score: 0, reason: "fail" },
    });
    expect(schema.parse({ pass: { score: 1, reason: "pass" } })).toEqual({
      pass: { score: 1, reason: "pass" },
    });
    expect(() => schema.parse({ pass: { score: 2, reason: "too high" } })).toThrow();
    expect(() => schema.parse({ pass: { score: -1, reason: "too low" } })).toThrow();
  });

  it("rejects missing dimension key", () => {
    const dims: Dimension[] = [
      { key: "accuracy", label: "Accuracy", weight: 1 },
    ];
    const schema = buildJudgeSchema(dims);
    expect(() => schema.parse({})).toThrow();
  });
});

describe("computeOverallScore", () => {
  it("computes weighted average for multiple dimensions", () => {
    const dims: Dimension[] = [
      { key: "accuracy", label: "Accuracy", weight: 0.5 },
      { key: "completeness", label: "Completeness", weight: 0.3 },
      { key: "tone", label: "Tone", weight: 0.2 },
    ];
    const scores = {
      accuracy: { score: 10, reason: "perfect" },
      completeness: { score: 8, reason: "good" },
      tone: { score: 6, reason: "ok" },
    };
    // (10*0.5 + 8*0.3 + 6*0.2) / (0.5+0.3+0.2) = (5+2.4+1.2)/1 = 8.6
    expect(computeOverallScore(scores, dims)).toBe(8.6);
  });

  it("handles equal weights", () => {
    const dims: Dimension[] = [
      { key: "a", label: "A", weight: 1 },
      { key: "b", label: "B", weight: 1 },
    ];
    const scores = {
      a: { score: 8, reason: "" },
      b: { score: 6, reason: "" },
    };
    // (8*1 + 6*1) / 2 = 7
    expect(computeOverallScore(scores, dims)).toBe(7);
  });

  it("falls back to default dimension for empty array", () => {
    const scores = { overall: { score: 7, reason: "decent" } };
    expect(computeOverallScore(scores, [])).toBe(7);
  });

  it("returns 0 when total weight is 0", () => {
    const dims: Dimension[] = [
      { key: "a", label: "A", weight: 0 },
    ];
    const scores = { a: { score: 8, reason: "" } };
    expect(computeOverallScore(scores, dims)).toBe(0);
  });

  it("handles missing score entry gracefully", () => {
    const dims: Dimension[] = [
      { key: "a", label: "A", weight: 1 },
      { key: "b", label: "B", weight: 1 },
    ];
    const scores = {
      a: { score: 8, reason: "" },
    };
    // Only 'a' contributes: (8*1 + 0) / 2 = 4
    expect(computeOverallScore(scores, dims)).toBe(4);
  });
});

describe("toJudgeResult", () => {
  it("returns JudgeResult with scores and computed overallScore", () => {
    const dims: Dimension[] = [
      { key: "accuracy", label: "Accuracy", weight: 1 },
    ];
    const raw = { accuracy: { score: 9, reason: "correct" } };
    const result = toJudgeResult(raw, dims);

    expect(result.scores).toEqual(raw);
    expect(result.overallScore).toBe(9);
  });

  it("works with empty dimensions (default overall)", () => {
    const raw = { overall: { score: 7, reason: "ok" } };
    const result = toJudgeResult(raw, []);

    expect(result.scores).toEqual(raw);
    expect(result.overallScore).toBe(7);
  });
});

describe("getScoreMax", () => {
  it("returns 10 for undefined dimensions", () => {
    expect(getScoreMax(undefined)).toBe(10);
  });

  it("returns 10 for empty array", () => {
    expect(getScoreMax([])).toBe(10);
  });

  it("returns 1 for binary dimensions (all max=1)", () => {
    const dims: Dimension[] = [
      { key: "pass", label: "Pass", weight: 1, min: 0, max: 1 },
    ];
    expect(getScoreMax(dims)).toBe(1);
  });

  it("returns 10 for standard 0-10 dimensions", () => {
    const dims: Dimension[] = [
      { key: "accuracy", label: "Accuracy", weight: 0.5, min: 0, max: 10 },
      { key: "tone", label: "Tone", weight: 0.5, min: 0, max: 10 },
    ];
    expect(getScoreMax(dims)).toBe(10);
  });

  it("returns uniform max when all dimensions share the same max", () => {
    const dims: Dimension[] = [
      { key: "a", label: "A", weight: 0.6, min: 0, max: 5 },
      { key: "b", label: "B", weight: 0.4, min: 0, max: 5 },
    ];
    expect(getScoreMax(dims)).toBe(5);
  });

  it("returns weighted max for mixed max values", () => {
    const dims: Dimension[] = [
      { key: "a", label: "A", weight: 0.5, min: 0, max: 10 },
      { key: "b", label: "B", weight: 0.5, min: 0, max: 1 },
    ];
    // (10*0.5 + 1*0.5) / 1 = 5.5
    expect(getScoreMax(dims)).toBe(5.5);
  });

  it("returns 10 when total weight is 0", () => {
    const dims: Dimension[] = [
      { key: "a", label: "A", weight: 0, min: 0, max: 5 },
    ];
    expect(getScoreMax(dims)).toBe(10);
  });

  it("defaults max to 10 when not specified", () => {
    const dims: Dimension[] = [
      { key: "a", label: "A", weight: 1 },
    ];
    expect(getScoreMax(dims)).toBe(10);
  });
});
