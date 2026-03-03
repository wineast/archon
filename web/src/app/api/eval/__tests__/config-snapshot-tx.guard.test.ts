/**
 * 缺陷守护：Eval Run/Batch 创建时配置快照查询必须在 Repeatable Read 事务中执行
 *
 * Cause Anchor: run/route.ts 和 batch/route.ts 的配置查询 + 写入
 *   包在 db.transaction({ isolationLevel: "repeatable read" }) 内，
 *   resolveEditingVersionId 使用传入的 tx 而非顶层 db
 * Boundary: resolveEditingVersionId 向后兼容、ConfigError 处理、Inngest 事务外发送
 * Blast Shield: resolveEditingVersionId 默认参数保持向后兼容
 *
 * @see .task/DEFECT.md
 * @see .task/FIX_REPORT.md
 * @see .task/VERIFY_REPORT.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Source code for structural analysis ──

const runRouteSource = readFileSync(
  resolve(__dirname, "../../eval/run/route.ts"),
  "utf-8"
);

const batchRouteSource = readFileSync(
  resolve(__dirname, "../../eval/batch/route.ts"),
  "utf-8"
);

const resolveSource = readFileSync(
  resolve(__dirname, "../../../../lib/versions/resolve.ts"),
  "utf-8"
);

describe("Guard: 配置快照查询在 Repeatable Read 事务中执行", () => {
  describe("Cause Anchor: run/route.ts 事务包裹", () => {
    it("使用 db.transaction 包裹配置查询", () => {
      expect(runRouteSource).toContain("db.transaction(");
    });

    it("事务使用 repeatable read 隔离级别", () => {
      expect(runRouteSource).toContain('isolationLevel: "repeatable read"');
    });

    it("事务内通过 tx 调用 resolveEditingVersionId（不使用顶层 db）", () => {
      // 匹配 resolveEditingVersionId(agentId, tx) 或 resolveEditingVersionId(judgeAgentId, tx)
      const txCalls = runRouteSource.match(
        /resolveEditingVersionId\([^)]*,\s*tx\)/g
      );
      expect(txCalls).not.toBeNull();
      expect(txCalls!.length).toBeGreaterThanOrEqual(2);
    });

    it("事务内配置查询使用 tx.select 而非 db.select", () => {
      // 在 db.transaction 回调内部，所有 select 应通过 tx
      const txSelectCount = (runRouteSource.match(/tx\s*\.\s*select\(\)/g) || [])
        .length;
      expect(txSelectCount).toBeGreaterThanOrEqual(3); // modelConfig + judgeModelConfig + judgeConfig
    });

    it("事务内 insert 使用 tx.insert 而非 db.insert", () => {
      const txInsertCount = (runRouteSource.match(/tx\s*\.\s*insert\(/g) || [])
        .length;
      expect(txInsertCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Cause Anchor: batch/route.ts 事务包裹", () => {
    it("使用 db.transaction 包裹配置查询", () => {
      expect(batchRouteSource).toContain("db.transaction(");
    });

    it("事务使用 repeatable read 隔离级别", () => {
      expect(batchRouteSource).toContain('isolationLevel: "repeatable read"');
    });

    it("事务内通过 tx 调用 resolveEditingVersionId", () => {
      const txCalls = batchRouteSource.match(
        /resolveEditingVersionId\([^)]*,\s*tx\)/g
      );
      expect(txCalls).not.toBeNull();
      expect(txCalls!.length).toBeGreaterThanOrEqual(2);
    });

    it("事务内配置查询使用 tx.select", () => {
      const txSelectCount = (
        batchRouteSource.match(/tx\s*\.\s*select\(\)/g) || []
      ).length;
      expect(txSelectCount).toBeGreaterThanOrEqual(3);
    });

    it("事务内 batch + run insert 使用 tx.insert", () => {
      const txInsertCount = (
        batchRouteSource.match(/tx\s*\.\s*insert\(/g) || []
      ).length;
      // batch insert + N run inserts (at least 2: batch + one run in loop)
      expect(txInsertCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Cause Anchor: resolveEditingVersionId 支持事务上下文", () => {
    it("导出 Tx 类型", () => {
      expect(resolveSource).toContain("export type Tx");
    });

    it("函数签名包含可选 conn 参数", () => {
      // conn: Tx | typeof db = db
      expect(resolveSource).toMatch(/conn:\s*Tx\s*\|\s*typeof\s+db\s*=\s*db/);
    });

    it("函数体使用 conn 而非 db 执行查询", () => {
      // 在 resolveEditingVersionId 函数体内应使用 conn.select 而非 db.select
      const fnBody = resolveSource.slice(
        resolveSource.indexOf("export async function resolveEditingVersionId"),
        resolveSource.indexOf("return agent.editingVersionId;")
      );
      expect(fnBody).toContain("await conn");
      // 函数体内不应直接使用 db.select
      expect(fnBody).not.toMatch(/await\s+db\s*\./);
    });
  });

  describe("Boundary: resolveEditingVersionId 向后兼容", () => {
    it("conn 参数有默认值 db（不传时使用顶层 db）", () => {
      expect(resolveSource).toMatch(/conn:\s*Tx\s*\|\s*typeof\s+db\s*=\s*db/);
    });

    it("其他函数（resolvePublishedVersionId 等）未被修改，仍直接使用 db", () => {
      const publishedFnBody = resolveSource.slice(
        resolveSource.indexOf(
          "export async function resolvePublishedVersionId"
        ),
        resolveSource.indexOf(
          "return agent.publishedVersionId;",
          resolveSource.indexOf("resolvePublishedVersionId")
        )
      );
      // resolvePublishedVersionId 应继续使用 db 而非 conn
      expect(publishedFnBody).toContain("await db");
      expect(publishedFnBody).not.toContain("conn");
    });
  });

  describe("Boundary: ConfigError 错误处理", () => {
    it("run/route.ts 定义 ConfigError 类", () => {
      expect(runRouteSource).toContain("class ConfigError extends Error");
    });

    it("run/route.ts 事务内 throw ConfigError、外层 catch 转 400", () => {
      expect(runRouteSource).toContain("throw new ConfigError(");
      expect(runRouteSource).toContain("instanceof ConfigError");
      expect(runRouteSource).toContain("status: 400");
    });

    it("batch/route.ts 同样使用 ConfigError 模式", () => {
      expect(batchRouteSource).toContain("class ConfigError extends Error");
      expect(batchRouteSource).toContain("throw new ConfigError(");
      expect(batchRouteSource).toContain("instanceof ConfigError");
    });
  });

  describe("Boundary: Inngest 事件在事务外发送", () => {
    it("run/route.ts 的 inngest.send 在 db.transaction 块之后", () => {
      const txEnd = runRouteSource.lastIndexOf('isolationLevel: "repeatable read"');
      const inngestSend = runRouteSource.indexOf(
        "inngest.send(",
        txEnd
      );
      expect(inngestSend).toBeGreaterThan(txEnd);
    });

    it("batch/route.ts 的 inngest.send 在 db.transaction 块之后", () => {
      const txEnd = batchRouteSource.lastIndexOf('isolationLevel: "repeatable read"');
      const inngestSend = batchRouteSource.indexOf(
        "inngest.send(",
        txEnd
      );
      expect(inngestSend).toBeGreaterThan(txEnd);
    });
  });

  describe("Blast Shield: 并发检查仍在事务外（已知局限）", () => {
    it("run/route.ts 的 existingRunningBatch 查询在 db.transaction 之前", () => {
      const concurrencyCheck = runRouteSource.indexOf("existingRunningBatch");
      const txStart = runRouteSource.indexOf("db.transaction(");
      expect(concurrencyCheck).toBeLessThan(txStart);
    });

    it("batch/route.ts 的 existingRunning 查询在 db.transaction 之前", () => {
      const concurrencyCheck = batchRouteSource.indexOf("existingRunning");
      const txStart = batchRouteSource.indexOf("db.transaction(");
      expect(concurrencyCheck).toBeLessThan(txStart);
    });
  });
});
