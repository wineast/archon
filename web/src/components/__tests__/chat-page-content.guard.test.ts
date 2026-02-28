/**
 * 缺陷守护：流式回复中"新对话"必须先 stop() 再清空消息
 *
 * handleNewChat 必须调用 stop() 中断 SSE 流后再 setMessages([])，
 * 否则 useChat 内部的 stream reader 会持续接收 chunk 覆盖空消息数组，
 * 导致用户被"拉回"原对话。
 *
 * 守护方式：源码断言——读取组件源码，验证关键调用模式。
 * 这种方式适合守护"简单但关键"的调用约定，防止未来重构时误删 stop()。
 *
 * @see .worktree/DEFECT.md
 * @see .worktree/FIX_REPORT.md
 * @see .worktree/VERIFY_REPORT.md
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC_PATH = resolve(
  __dirname,
  "../../components/chat-page-content.tsx"
);
const source = readFileSync(SRC_PATH, "utf-8");

/**
 * 提取 handleNewChat 的 useCallback 整体代码块（含依赖数组）。
 *
 * 匹配模式：
 *   const handleNewChat = useCallback(() => {
 *     ...函数体...
 *   }, [...deps...]);
 */
function extractHandleNewChat(src: string): {
  body: string;
  deps: string;
} | null {
  // 找到 handleNewChat = useCallback 的起始位置
  const marker = "const handleNewChat = useCallback(";
  const startIdx = src.indexOf(marker);
  if (startIdx === -1) return null;

  // 从 marker 之后找到函数体的 `() => {`
  const afterMarker = src.slice(startIdx + marker.length);
  const bodyStart = afterMarker.indexOf("{");
  if (bodyStart === -1) return null;

  // 用括号匹配找到函数体结束的 `}`
  let depth = 0;
  let bodyEnd = -1;
  for (let i = bodyStart; i < afterMarker.length; i++) {
    if (afterMarker[i] === "{") depth++;
    if (afterMarker[i] === "}") depth--;
    if (depth === 0) {
      bodyEnd = i;
      break;
    }
  }
  if (bodyEnd === -1) return null;

  const body = afterMarker.slice(bodyStart + 1, bodyEnd).trim();

  // 函数体 `}` 之后应该是 `, [deps]);`
  const afterBody = afterMarker.slice(bodyEnd + 1);
  const depsMatch = afterBody.match(/,\s*\[([^\]]*)\]/);
  const deps = depsMatch ? depsMatch[1].trim() : "";

  return { body, deps };
}

describe("Guard: 流式回复中新对话必须先 stop() 再 setMessages", () => {
  const extracted = extractHandleNewChat(source);

  test("handleNewChat 函数存在", () => {
    expect(extracted).not.toBeNull();
  });

  describe("Cause Anchor: handleNewChat 必须调用 stop()", () => {
    test("handleNewChat 包含 stop() 调用", () => {
      expect(extracted!.body).toMatch(/\bstop\(\)/);
    });
  });

  describe("Boundary", () => {
    test("stop() 在 setMessages 之前被调用", () => {
      const stopIdx = extracted!.body.indexOf("stop()");
      const setMessagesIdx = extracted!.body.indexOf("setMessages(");
      expect(stopIdx).toBeGreaterThanOrEqual(0);
      expect(setMessagesIdx).toBeGreaterThanOrEqual(0);
      expect(stopIdx).toBeLessThan(setMessagesIdx);
    });

    test("stop 在 useCallback 依赖数组中", () => {
      expect(extracted!.deps).toMatch(/\bstop\b/);
    });
  });

  describe("Blast Shield: 原有逻辑未被破坏", () => {
    test("handleNewChat 仍调用 setMessages([])", () => {
      expect(extracted!.body).toMatch(/setMessages\(\s*\[\s*\]\s*\)/);
    });
  });
});
