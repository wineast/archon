import { describe, it, expect } from "vitest";
import {
  renderJudgePrompt,
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_TURN_PROMPT_TEMPLATE,
} from "../judge-prompt";
import type { JudgePromptVars } from "../judge-prompt";

const baseVars: JudgePromptVars = {
  mode: "single",
  user_input: "What is 2+2?",
  expected_output: "4",
  actual_response: "The answer is 4.",
  conversation: "[User]: What is 2+2?\n[Assistant]: The answer is 4.",
};

describe("renderJudgePrompt", () => {
  it("uses default template when template is null", async () => {
    const result = await renderJudgePrompt(null, baseVars, false);
    expect(result).toContain("User Input: What is 2+2?");
    expect(result).toContain("Actual Response: The answer is 4.");
    expect(result).toContain("Expected Output: 4");
  });

  it("uses default template when template is empty string", async () => {
    const result = await renderJudgePrompt("", baseVars, false);
    expect(result).toContain("User Input: What is 2+2?");
  });

  it("single mode: outputs User Input + Actual Response, no Conversation", async () => {
    const result = await renderJudgePrompt(null, baseVars, false);
    expect(result).toContain("User Input: What is 2+2?");
    expect(result).toContain("Actual Response: The answer is 4.");
    expect(result).not.toContain("Conversation:");
  });

  it("multi mode: outputs Conversation, no User Input / Actual Response", async () => {
    const vars = { ...baseVars, mode: "sequential" };
    const result = await renderJudgePrompt(null, vars, false);
    expect(result).toContain("Conversation:");
    expect(result).toContain("[User]: What is 2+2?");
    expect(result).not.toContain("User Input:");
    expect(result).not.toContain("Actual Response:");
  });

  it("skips expected_output when empty", async () => {
    const vars = { ...baseVars, expected_output: "" };
    const result = await renderJudgePrompt(null, vars, false);
    expect(result).not.toContain("Expected Output:");
  });

  it("custom template overrides default", async () => {
    const custom = "INPUT: {{ user_input }} | OUTPUT: {{ actual_response }}";
    const result = await renderJudgePrompt(custom, baseVars, false);
    expect(result).toBe("INPUT: What is 2+2? | OUTPUT: The answer is 4.");
  });

  it("falls back to default on syntax error", async () => {
    const broken = "{% if unclosed";
    const result = await renderJudgePrompt(broken, baseVars, false);
    // Should get the default output instead of throwing
    expect(result).toContain("User Input: What is 2+2?");
  });

  it("per-turn default template renders correctly", async () => {
    const vars = { ...baseVars, mode: "sequential" };
    const result = await renderJudgePrompt(null, vars, true);
    expect(result).toContain("Conversation:");
    expect(result).toContain("Expected Output: 4");
  });

  it("per-turn template skips expected_output when empty", async () => {
    const vars = { ...baseVars, mode: "sequential", expected_output: "" };
    const result = await renderJudgePrompt(null, vars, true);
    expect(result).toContain("Conversation:");
    expect(result).not.toContain("Expected Output:");
  });

  it("per-turn custom template overrides default", async () => {
    const custom = "TURN: {{ conversation }} | EXPECTED: {{ expected_output }}";
    const vars = { ...baseVars, mode: "sequential" };
    const result = await renderJudgePrompt(custom, vars, true);
    expect(result).toBe(
      "TURN: [User]: What is 2+2?\n[Assistant]: The answer is 4. | EXPECTED: 4"
    );
  });

  it("per-turn falls back to default on syntax error", async () => {
    const broken = "{% for x in";
    const vars = { ...baseVars, mode: "sequential" };
    const result = await renderJudgePrompt(broken, vars, true);
    // Should get the per-turn default output instead of throwing
    expect(result).toContain("Conversation:");
    expect(result).toContain("Expected Output: 4");
  });

  it("exports default templates as non-empty strings", () => {
    expect(DEFAULT_PROMPT_TEMPLATE.length).toBeGreaterThan(0);
    expect(DEFAULT_TURN_PROMPT_TEMPLATE.length).toBeGreaterThan(0);
  });
});
