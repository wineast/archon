# 验证报告：Eval Run/Batch 配置快照事务隔离

> 验证时间：2026-03-02 21:40
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-eval-run-config-snapshot-no-transaction-20260302`

## 1. Reproduction Result（复现验证）

### 验证方式
此缺陷为代码结构级并发竞态，无法通过 UI 操作稳定复现。通过独立代码审计验证：
1. 确认修复后 `run/route.ts` 中所有配置查询（2 次 `resolveEditingVersionId` + 3 次 `tx.select()`）和 run 创建均在 `db.transaction()` 内（L61-147）
2. 确认 `batch/route.ts` 中配置查询 + batch 创建 + N 个 run 创建循环均在 `db.transaction()` 内（L68-179）
3. 确认 `resolveEditingVersionId` 使用传入的 `tx` 而非顶层 `db`（`conn` 参数，L24）
4. 确认事务使用 `{ isolationLevel: "repeatable read" }` 隔离级别

### 结果
**通过**。配置快照的全部查询和写入操作已包入事务，且使用 Repeatable Read 隔离级别确保跨语句快照一致性。

## 2. Cause-Fix Coherence（因果一致性）

### Root Cause 可解释 Delta？
**成立。** Root Cause 声称：5 次独立查询在 Postgres Read Committed 下各自拿到执行时刻的快照，并发修改可导致不一致组合。这直接导出 Delta 描述的现象（judgeModelConfig 旧 + judgeConfig 新）。因果链完整，无更合理的替代解释。

### Change 可消除 Root Cause？
**需修正后成立。** 初始修复仅使用 `db.transaction()` 未指定隔离级别（默认 Read Committed）。验证阶段发现：**Read Committed 下事务内每条 SELECT 仍有独立快照**，跨语句一致性未实际保证。

PostgreSQL 文档原文：
> "two successive SELECT commands can see different data, even though they are within a single transaction, if other transactions commit changes after the first SELECT starts and before the second SELECT starts."

**修正**：在 `db.transaction()` 的第二参数添加 `{ isolationLevel: "repeatable read" }`。Repeatable Read 下所有语句共享事务开始时的快照，从机理上切断了不一致窗口。修正后因果链闭合。

### Rationale 无漏洞？
**成立。** 三个被排除方案的排除理由均合理：
- SQL JOIN 合并：改动大且无法覆盖 version 解析查询
- SERIALIZABLE：过重，引入序列化失败重试复杂度
- Advisory lock：锁粒度难界定，读事务已足够

补充：选择 Repeatable Read 而非 Serializable 是正确的——本事务以 SELECT + INSERT 为主，不涉及 UPDATE 已有行，序列化失败概率为零。

### 结果
**一致**（经修正后）。初始修复遗漏了隔离级别配置，验证阶段发现并修正，因果链现已完整闭合。

## 3. Boundary Validation（边界验证）

### 测试的边界变体
| 变体 | 条件 | 结果 |
|------|------|------|
| `resolveEditingVersionId` 向后兼容 | 30+ 个现有调用方不传 `tx` 参数 | **通过** — `conn` 参数默认值为 `db`，所有调用方无需修改 |
| ConfigError 错误处理 | 缺少 active modelConfig / judgeConfig | **通过** — 单测覆盖 3 种缺配置 400 场景（create-run.test.ts L170-195） |
| Inngest 事件在事务外 | 事务提交后才发送 Inngest 事件 | **通过** — 正确设计：事件引用的 run.id 在事务提交后才存在，避免 Inngest worker 读到未提交数据 |
| batch 循环中 N 个 run 一致性 | repeatCount > 1 时所有 run 使用同一配置快照 | **通过** — 循环在事务内，Repeatable Read 保证所有 run 共享同一快照 |

### 结果
**通过**。所有边界变体验证正常。

## 4. Regression Result（回归验证）

### 静态检查
- `make typecheck`：通过
- `make test`：122 文件通过，1390 用例通过

### Blast Radius 区域验证
| 区域 | 修复报告声明 | 实际验证结果 |
|------|-------------|-------------|
| `POST /api/eval/run` | 直接影响 | **正常** — 14 个单测全部通过 |
| `POST /api/eval/batch` | 直接影响 | **正常** — 无独立测试，代码结构审计确认 |
| `resolveEditingVersionId` 其他调用方 | 不影响（默认参数兼容） | **正常** — 30+ 调用方无需修改，typecheck 通过 |
| Eval Run 执行流程（Inngest worker） | 不影响 | **正常** — Inngest 事件在事务外发送，worker 代码未改动 |
| 其他 eval API | 不影响 | **正常** — retry-failed 等 API 测试通过 |

### 结果
**通过**。静态检查全部通过，Blast Radius 区域无回归。

## 5. Verdict（裁定）

### 判决
**合并**

### 证据摘要
- **Reproduction**：代码审计确认配置查询和创建操作全部在 `db.transaction({ isolationLevel: "repeatable read" })` 内
- **Coherence**：验证阶段发现并修正了隔离级别遗漏（Read Committed → Repeatable Read），因果链完整闭合
- **Boundary**：向后兼容、错误处理、Inngest 时序、batch 循环一致性均验证通过
- **Regression**：typecheck 通过 + 1390 单测通过 + Blast Radius 区域无回归

### 残留风险
- 并发检查（`existingRunningBatch`）仍在事务外，存在 TOCTOU 竞态。这是独立缺陷，不影响本次修复的配置快照一致性目标
- `Tx` 类型目前在 `resolve.ts` 中定义。如果未来更多模块需要事务支持，建议提取到 `@/db/types`

## 过程备注

- [惊讶] 初始修复未指定隔离级别。Postgres Read Committed 下 `db.transaction()` 不保证跨 SELECT 快照一致性——这是一个常见误解。查阅 PostgreSQL 官方文档后确认需要 Repeatable Read
- [确认] Drizzle ORM 的 `db.transaction()` 第二参数支持 `{ isolationLevel: "repeatable read" }`，已在两个 route 中添加
- [确认] Repeatable Read 下本事务无序列化失败风险（只有 SELECT + INSERT，不 UPDATE 已有行）
