/**
 * 缺陷守护：工具测试端点必须验证 Agent editor 权限后才执行代码
 *
 * Cause Anchor: route handler 在 executeToolHandler 前调用 requireAgentRole
 * Trigger: 缺少 agentId / 授权失败 → 代码不执行
 * Boundary: agentId 缺失、类型错误、授权 401/403、授权通过但缺 handler、正常执行
 *
 * @see .worktree/DEFECT.md
 * @see .worktree/FIX_REPORT.md
 * @see .worktree/VERIFY_REPORT.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mocks ──

const mockRequireAgentRole = vi.fn();
vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: (...args: unknown[]) => mockRequireAgentRole(...args),
}));

const mockExecuteToolHandler = vi.fn();
vi.mock("@/lib/tools/execute-handler", () => ({
  executeToolHandler: (...args: unknown[]) => mockExecuteToolHandler(...args),
}));

vi.mock("@/lib/tools/tool-context", () => ({
  createToolContext: () => ({ wiki: {}, dataset: {}, fn: {}, ontology: {} }),
}));

// ── Helpers ──

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/tools/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

// ── Import route handler ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let POST: (req: any) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockRequireAgentRole.mockResolvedValue({ user: { id: "u1" }, role: "editor", isSuperAdmin: false });
  mockExecuteToolHandler.mockResolvedValue("ok");
  const mod = await import("../route");
  POST = mod.POST;
});

describe("Guard: tools/test 端点授权", () => {
  describe("Cause Anchor: requireAgentRole 在执行前检查", () => {
    it("授权返回 403 时不调用 executeToolHandler", async () => {
      mockRequireAgentRole.mockResolvedValue(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );

      const res = await POST(makeRequest({
        agentId: "agent-1",
        handler: "export default async function() { return 1; }",
        args: {},
      }));

      expect(res.status).toBe(403);
      expect(mockExecuteToolHandler).not.toHaveBeenCalled();
    });

    it("授权返回 401 时不调用 executeToolHandler", async () => {
      mockRequireAgentRole.mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );

      const res = await POST(makeRequest({
        agentId: "agent-1",
        handler: "export default async function() { return 1; }",
        args: {},
      }));

      expect(res.status).toBe(401);
      expect(mockExecuteToolHandler).not.toHaveBeenCalled();
    });

    it("调用 requireAgentRole 时传入正确的 agentId 和 minRole", async () => {
      await POST(makeRequest({
        agentId: "my-agent-id",
        handler: "export default async function() { return 1; }",
        args: {},
      }));

      expect(mockRequireAgentRole).toHaveBeenCalledWith("my-agent-id", "editor");
    });
  });

  describe("Boundary", () => {
    it("缺少 agentId → 400", async () => {
      const res = await POST(makeRequest({
        handler: "export default async function() { return 1; }",
        args: {},
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("agentId is required");
      expect(mockRequireAgentRole).not.toHaveBeenCalled();
      expect(mockExecuteToolHandler).not.toHaveBeenCalled();
    });

    it("agentId 为 number → 400", async () => {
      const res = await POST(makeRequest({
        agentId: 123,
        handler: "export default async function() { return 1; }",
        args: {},
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("agentId is required");
      expect(mockRequireAgentRole).not.toHaveBeenCalled();
    });

    it("agentId 为空字符串 → 400", async () => {
      const res = await POST(makeRequest({
        agentId: "",
        handler: "export default async function() { return 1; }",
        args: {},
      }));

      expect(res.status).toBe(400);
    });

    it("授权通过但缺少 handler → 400", async () => {
      const res = await POST(makeRequest({
        agentId: "agent-1",
        args: {},
      }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("handler is required");
      expect(mockExecuteToolHandler).not.toHaveBeenCalled();
    });

    it("授权通过且参数完整 → 正常执行", async () => {
      mockExecuteToolHandler.mockResolvedValue({ answer: 42 });

      const res = await POST(makeRequest({
        agentId: "agent-1",
        handler: "export default async function() { return { answer: 42 }; }",
        args: { x: 1 },
      }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.result).toEqual({ answer: 42 });
      expect(mockExecuteToolHandler).toHaveBeenCalled();
    });
  });
});
