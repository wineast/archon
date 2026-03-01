/**
 * 缺陷守护：版本操作接口必须校验 versionId 归属 agentId（防 IDOR 越权）
 *
 * Invariant: 所有版本操作 API 的 version 查询 WHERE 子句必须包含
 * agentVersions.agentId 条件，使用 and() 组合多条件，确保 versionId
 * 必须属于路径中的 agentId。
 *
 * @see .worktree/DEFECT.md
 * @see .worktree/FIX_REPORT.md
 * @see .worktree/VERIFY_REPORT.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

// ── Route file paths (relative to this __tests__ directory) ──
const ROUTES_BASE = path.resolve(__dirname, "..");

const ROUTE_FILES = [
  { file: "[versionId]/publish/route.ts", label: "POST publish" },
  { file: "[versionId]/rollback/route.ts", label: "POST rollback" },
  { file: "[versionId]/route.ts", label: "GET/DELETE [versionId]" },
  { file: "switch/route.ts", label: "POST switch" },
];

// ── Mocks for behavioral tests ──
const requireAgentRoleMock = vi.fn();
vi.mock("@/lib/auth/require-agent-role", () => ({
  requireAgentRole: (...args: unknown[]) => requireAgentRoleMock(...args),
}));

const limitMock = vi.fn();
const selectWhereMock = vi.fn().mockReturnValue({ limit: limitMock });
const fromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
const selectMock = vi.fn().mockReturnValue({ from: fromMock });

const updateWhereMock = vi.fn().mockResolvedValue(undefined);
const setMock = vi.fn().mockReturnValue({ where: updateWhereMock });
const updateMock = vi.fn().mockReturnValue({ set: setMock });

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  agents: { id: "id", publishedVersionId: "published_version_id" },
  agentVersions: { id: "id", agentId: "agent_id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

describe("Guard: 版本操作接口 versionId 归属校验 — 防 IDOR 越权", () => {
  // ── Cause Anchor: 源码断言 ──

  describe("Cause Anchor: WHERE 子句包含 agentVersions.agentId 条件", () => {
    for (const { file, label } of ROUTE_FILES) {
      it(`${label} — 源码包含 agentVersions.agentId`, () => {
        const src = fs.readFileSync(path.join(ROUTES_BASE, file), "utf-8");
        expect(src).toContain("agentVersions.agentId");
      });

      it(`${label} — 源码 import and()`, () => {
        const src = fs.readFileSync(path.join(ROUTES_BASE, file), "utf-8");
        // Verify 'and' is imported from drizzle-orm
        expect(src).toMatch(/import\s*\{[^}]*\band\b[^}]*\}\s*from\s*["']drizzle-orm["']/);
      });
    }
  });

  // ── Trigger Scenario + Blast Shield: 行为测试 (publish 接口) ──

  describe("Trigger Scenario: publish 接口越权 versionId 返回 404", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      requireAgentRoleMock.mockResolvedValue({
        user: { id: "user-1" },
        role: "admin",
      });
    });

    it("跨 agent 的 versionId（version 查询返回空）→ 404", async () => {
      // Simulate: version query returns empty (agentId mismatch)
      limitMock.mockResolvedValue([]);

      const { POST } = await import(
        "@/app/api/agents/[id]/versions/[versionId]/publish/route"
      );

      const res = await POST(new NextRequest("http://localhost"), {
        params: Promise.resolve({
          id: "agent-a",
          versionId: "agent-b-version",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Version not found");
    });

    it("同 agent 的 versionId（version 查询命中）→ 200", async () => {
      // Simulate: version query finds a match (agentId matches)
      limitMock.mockResolvedValue([{ id: "version-1" }]);

      const { POST } = await import(
        "@/app/api/agents/[id]/versions/[versionId]/publish/route"
      );

      const res = await POST(new NextRequest("http://localhost"), {
        params: Promise.resolve({
          id: "agent-a",
          versionId: "version-1",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  // ── Boundary: 所有 5 个端点的源码断言 ──

  describe("Boundary: DELETE [versionId] 也包含 agentId 校验", () => {
    it("DELETE 的 where 子句包含 agentVersions.agentId", () => {
      const src = fs.readFileSync(
        path.join(ROUTES_BASE, "[versionId]/route.ts"),
        "utf-8"
      );
      // DELETE handler uses db.delete().where(and(...agentId...))
      // Count occurrences: GET has one, DELETE has one → at least 2
      const matches = src.match(/agentVersions\.agentId/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Blast Shield: 修复不影响正常路径 ──

  describe("Blast Shield: 版本列表接口保持正确的 agentId 过滤", () => {
    it("versions/route.ts GET 已有 agentVersions.agentId 条件", () => {
      const src = fs.readFileSync(
        path.join(ROUTES_BASE, "route.ts"),
        "utf-8"
      );
      expect(src).toContain("agentVersions.agentId");
    });
  });
});
