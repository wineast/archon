// @vitest-environment jsdom

import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ResultCard } from "../result-card";
import type { EvalResult } from "@/lib/eval/types";

function makeResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    caseId: "c1",
    caseName: "Test Case",
    mode: "single",
    turns: [{ id: "t1", role: "user", content: "Hello" }],
    chatMessages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
    turnResults: [],
    chatResponse: "Hi there",
    assertionResults: [],
    allAssertionsPassed: true,
    judgeResult: null,
    timestamp: Date.now(),
    durationMs: 100,
    ...overrides,
  };
}

describe("ResultCard — tool output 展示", () => {
  it("有 result 时渲染可折叠的 Output", () => {
    const result = makeResult({
      chatMessages: [
        { role: "user", content: "Hello" },
        {
          role: "assistant",
          content: "Let me check",
          toolCalls: [
            { name: "search", args: { q: "test" }, result: "found 3 items" },
          ],
        },
      ],
    });
    render(<ResultCard result={result} />);

    expect(screen.getByText("search")).toBeInTheDocument();
    const details = screen.getByTestId("tool-output");
    expect(details).toBeInTheDocument();
    expect(details.querySelector("pre")).toHaveTextContent("found 3 items");
  });

  it("result 为对象时 JSON 格式化展示", () => {
    const result = makeResult({
      chatMessages: [
        { role: "user", content: "Hello" },
        {
          role: "assistant",
          content: "Result",
          toolCalls: [
            { name: "lookup", args: {}, result: { id: 1, name: "item" } },
          ],
        },
      ],
    });
    render(<ResultCard result={result} />);

    const pre = screen.getByTestId("tool-output").querySelector("pre");
    expect(pre?.textContent).toContain('"id": 1');
    expect(pre?.textContent).toContain('"name": "item"');
  });

  it("无 result 时不渲染 Output 折叠", () => {
    const result = makeResult({
      chatMessages: [
        { role: "user", content: "Hello" },
        {
          role: "assistant",
          content: "Hi",
          toolCalls: [
            { name: "ping", args: { target: "server" } },
          ],
        },
      ],
    });
    render(<ResultCard result={result} />);

    expect(screen.getByText("ping")).toBeInTheDocument();
    expect(screen.queryByTestId("tool-output")).not.toBeInTheDocument();
  });

  it("result 为 null 时不渲染 Output 折叠（向后兼容）", () => {
    const result = makeResult({
      chatMessages: [
        { role: "user", content: "Hello" },
        {
          role: "assistant",
          content: "Done",
          toolCalls: [
            { name: "noop", args: {}, result: null },
          ],
        },
      ],
    });
    render(<ResultCard result={result} />);

    expect(screen.getByText("noop")).toBeInTheDocument();
    expect(screen.queryByTestId("tool-output")).not.toBeInTheDocument();
  });

  it("多个工具调用混合有/无 result 时独立渲染", () => {
    const result = makeResult({
      chatMessages: [
        { role: "user", content: "Hello" },
        {
          role: "assistant",
          content: "Results",
          toolCalls: [
            { name: "tool_a", args: {}, result: "output_a" },
            { name: "tool_b", args: { x: 1 } },
            { name: "tool_c", args: {}, result: { ok: true } },
          ],
        },
      ],
    });
    render(<ResultCard result={result} />);

    expect(screen.getByText("tool_a")).toBeInTheDocument();
    expect(screen.getByText("tool_b")).toBeInTheDocument();
    expect(screen.getByText("tool_c")).toBeInTheDocument();
    const outputs = screen.getAllByTestId("tool-output");
    expect(outputs).toHaveLength(2);
    expect(outputs[0].querySelector("pre")).toHaveTextContent("output_a");
    expect(outputs[1].querySelector("pre")?.textContent).toContain('"ok": true');
  });

  it("多轮模式也渲染工具输出", () => {
    const result = makeResult({
      mode: "injected",
      turns: [
        { id: "t1", role: "user", content: "Hello" },
        { id: "t2", role: "assistant", content: "Checking..." },
        { id: "t3", role: "user", content: "Status?" },
      ],
      chatMessages: [
        { role: "user", content: "Hello", injected: true },
        {
          role: "assistant",
          content: "Checking...",
          injected: true,
          toolCalls: [
            { name: "check_status", args: { id: "123" }, result: "active" },
          ],
        },
        { role: "user", content: "Status?" },
        { role: "assistant", content: "It is active" },
      ],
    });
    render(<ResultCard result={result} />);

    expect(screen.getByText("check_status")).toBeInTheDocument();
    const details = screen.getByTestId("tool-output");
    expect(details.querySelector("pre")).toHaveTextContent("active");
  });
});
