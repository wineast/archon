/**
 * 缺陷守护：数据集查询加 versionId 过滤，消除跨版本虚假循环依赖
 *
 * Invariant: 多版本 Agent 的数据集查询、拓扑排序和模板渲染不得因跨版本重复 key
 * 而误报循环依赖；Preview 必须正确渲染模板变量，Save 必须成功。
 *
 * @see .worktree/DEFECT.md
 * @see .worktree/FIX_REPORT.md
 * @see .worktree/VERIFY_REPORT.md
 */
import { describe, it, expect, vi } from "vitest";
import {
  topoSortDatasets,
  resolveDatasets,
  validateNoCycle,
  getDatasets,
  getResolvedDatasets,
} from "../queries";

// Mock db / schema (not used by pure functions, but imported at module level)
vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/db/schema", () => ({
  datasets: {
    key: "key",
    name: "name",
    data: "data",
    versionId: "version_id",
    deletedAt: "deleted_at",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}));

describe("Guard: 数据集查询 versionId 过滤 — 消除跨版本虚假循环依赖", () => {
  // ── Cause Anchor: 根因层防线 ──

  describe("Cause Anchor: getDatasets/getResolvedDatasets 函数签名要求 versionId", () => {
    it("getDatasets 接受 2 个参数 (agentId, versionId)", () => {
      // 如果有人误删 versionId 参数，此断言失败
      expect(getDatasets.length).toBe(2);
    });

    it("getResolvedDatasets 接受 2 个参数 (agentId, versionId)", () => {
      expect(getResolvedDatasets.length).toBe(2);
    });
  });

  describe("Cause Anchor: 重复 key 输入触发 topoSort 误判（上游防线必要性）", () => {
    it("同 key 不同值（跨版本模拟）导致 sorted.length < records.length", () => {
      // 故障机制：Map 按 key 去重 → sorted 比 records 少 → 误判循环
      // 修复在上游 getDatasets 阻断此输入，此测试文档化机制仍在
      const records = [
        { key: "income_type", data: { se: "Self-Employed v1" } },
        { key: "income_type", data: { se: "Self-Employed v2" } },
        { key: "rates", data: { base: 4.5 } },
      ];
      expect(() => topoSortDatasets(records)).toThrow(/Circular dependency/);
    });
  });

  // ── Trigger Scenario: 症状层防线 ──

  describe("Trigger Scenario: 单版本数据集排序和渲染不误报", () => {
    it("唯一 key 集合排序后 length 等于输入 length（根因条件直接断言）", () => {
      const records = [
        { key: "income_type_enum", data: { self_employed: "NQM - Self-Employed" } },
        { key: "product_routes", data: { nqm: "{{income_type_enum.self_employed}}" } },
        { key: "base_rate", data: "4.5%" },
      ];
      const sorted = topoSortDatasets(records);
      expect(sorted.length).toBe(records.length);
    });

    it("模板变量正确渲染为实际值（Preview 症状消除）", () => {
      const records = [
        { key: "income_type_enum", data: { self_employed: "NQM - 1year Self-Employed" } },
        { key: "product_routes", data: { nqm_se: "{{income_type_enum.self_employed}}" } },
      ];
      const { resolvedVars } = resolveDatasets(records);
      expect(resolvedVars.product_routes).toEqual({
        nqm_se: "NQM - 1year Self-Employed",
      });
    });
  });

  // ── Boundary Set: 变体集 ──

  describe("Boundary: 经验变体（来自验证报告）", () => {
    it("无模板引用的纯 JSON 数据集正确通过", () => {
      const records = [
        { key: "income_type", data: { self_employed: "NQM Self-Employed", w2: "W2 Income" } },
      ];
      expect(() => topoSortDatasets(records)).not.toThrow();
      const { resolvedVars } = resolveDatasets(records);
      expect(resolvedVars.income_type).toEqual({
        self_employed: "NQM Self-Employed",
        w2: "W2 Income",
      });
    });

    it("新建数据集追加到列表不报循环依赖", () => {
      const existing = [
        { key: "base", data: "hello" },
        { key: "derived", data: "{{base}} world" },
      ];
      const newDataset = { key: "verify_test", data: { status: "ok" } };
      expect(() => validateNoCycle([...existing, newDataset])).not.toThrow();
    });
  });

  describe("Boundary: 推理变体（从 Root Cause 推导）", () => {
    it("数据集引用枚举子字段（{{enum.field}}）渲染正确", () => {
      const records = [
        {
          key: "income_type_enum",
          data: {
            self_employed: "NQM - Self-Employed",
            w2: "W2 Income",
            stated_income: "Stated Income",
          },
        },
        {
          key: "product_routes",
          data: {
            nqm_se: "{{income_type_enum.self_employed}}",
            w2_route: "{{income_type_enum.w2}}",
          },
        },
      ];
      const { resolvedVars } = resolveDatasets(records);
      expect(resolvedVars.product_routes).toEqual({
        nqm_se: "NQM - Self-Employed",
        w2_route: "W2 Income",
      });
    });

    it("多数据集链式引用（A→B→C）渲染正确", () => {
      const records = [
        { key: "base_rate", data: "4.5%" },
        { key: "rate_label", data: "Base rate: {{base_rate}}" },
        { key: "summary", data: "Current {{rate_label}}" },
      ];
      const { resolvedVars } = resolveDatasets(records);
      expect(resolvedVars.summary).toBe("Current Base rate: 4.5%");
    });
  });

  // ── Blast Shield: 修复波及区域回归 ──

  describe("Blast Shield: 数据集模板预览", () => {
    it("resolveDatasets 返回正确的 resolvedVars 和 datasetEntries", () => {
      const records = [
        { key: "states", data: { CA: "California", TX: "Texas" } },
        { key: "greeting", data: "Hello {{states.CA}}" },
      ];
      const { resolvedVars, datasetEntries } = resolveDatasets(records);
      expect(resolvedVars.greeting).toBe("Hello California");
      expect(datasetEntries.states).toEqual([
        { value: "California" },
        { value: "Texas" },
      ]);
    });
  });

  describe("Blast Shield: 数据集创建/更新循环检测", () => {
    it("真实循环依赖仍能正确检测", () => {
      expect(() =>
        validateNoCycle([
          { key: "a", data: "{{b}}" },
          { key: "b", data: "{{a}}" },
        ])
      ).toThrow(/Circular dependency/);
    });

    it("无循环的复杂依赖图（菱形 DAG）不误报", () => {
      // a → b, a → c, b → d, c → d（菱形依赖）
      const records = [
        { key: "a", data: "root" },
        { key: "b", data: "{{a}} left" },
        { key: "c", data: "{{a}} right" },
        { key: "d", data: "{{b}} + {{c}}" },
      ];
      expect(() => validateNoCycle(records)).not.toThrow();
      const { resolvedVars } = resolveDatasets(records);
      expect(resolvedVars.d).toBe("root left + root right");
    });
  });
});
