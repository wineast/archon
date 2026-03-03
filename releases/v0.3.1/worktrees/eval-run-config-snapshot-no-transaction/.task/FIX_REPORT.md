# 修复报告：Eval Run/Batch 配置快照查询包入数据库事务

> 修复时间：2026-03-02 21:30
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-eval-run-config-snapshot-no-transaction-20260302`

## 1. Root Cause（根因）

### 为什么坏了
Eval Run 和 Batch 创建时，配置快照的 5 次数据库查询（2 次 version 解析 + 3 次配置读取）以及 insert 操作是独立的 `await`，没有包在 `db.transaction()` 中。Postgres Read Committed 隔离级别下，每条语句看到的是该语句开始时的已提交数据，不同语句之间可以看到其他事务的中间提交。

### 因果链
1. 用户 A 发起 eval run，触发 5 次顺序配置查询
2. → 在查询 3（judge modelConfig）和查询 4（judgeConfig）之间，用户 B 切换了 judge agent 的 active 配置
3. → judgeModelConfig 读到旧配置 A，judgeConfig 读到新配置 B
4. → eval run 快照了不一致的配置组合，评测结果不可信

## 2. Change（变更）

### 修改摘要
将配置快照的全部查询和 run/batch 创建包入 `db.transaction()`，确保读取一致性。改造 `resolveEditingVersionId` 接受可选 `tx` 参数以支持在事务内调用。

### 修改明细
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/lib/versions/resolve.ts:1-21` | 新增 `Tx` 类型导出 + `resolveEditingVersionId` 增加可选 `conn` 参数 | 使函数可在事务上下文中使用，默认值 `db` 保持向后兼容 |
| `web/src/app/api/eval/run/route.ts:10,57-153` | 新增 `ConfigError` 类 + 将 L57-147 的配置查询和 insert 包入 `db.transaction({ isolationLevel: "repeatable read" })` | 事务内不能 `return Response`，改用 throw ConfigError + 外层 catch 转 400；Repeatable Read 确保跨 SELECT 快照一致性 |
| `web/src/app/api/eval/batch/route.ts:10,62-186` | 同 run/route.ts 模式，将配置查询 + batch 创建 + N 个 run 创建循环全部包入 `db.transaction({ isolationLevel: "repeatable read" })` | batch 场景查询窗口更长，事务化收益更大 |
| `web/src/app/api/eval/run/__tests__/create-run.test.ts:38-43` | `db` mock 增加 `transaction` 方法 | `transaction` 委托回调到同一套 mock 链，保持现有测试逻辑不变 |

## 3. Rationale（决策依据）

### 为什么选择此方案
- 项目已有 5 处 `db.transaction()` 使用先例，模式成熟
- `resolveEditingVersionId` 增加可选 `conn` 参数（默认 `db`），向后兼容，不影响其他 12+ 处调用方
- 事务内验证失败通过自定义 `ConfigError` + 外层 catch 转 HTTP 响应，保持错误处理语义不变

### 考虑过的替代方案
| 方案 | 未采用原因 |
|------|-----------|
| 将 3 次配置查询合并为 1 条 SQL JOIN | 改动大、可读性下降，且 `resolveEditingVersionId` 的 version 解析仍是独立查询，无法完全消除窗口 |
| 使用 Postgres SERIALIZABLE 隔离级别 | 过重——只需要 Read Committed + 事务级快照一致性，SERIALIZABLE 会引入序列化失败重试的额外复杂度 |
| 在查询前获取 advisory lock | 锁粒度难以界定，且 SELECT 事务已足够解决读一致性问题 |

### 已知局限
- 并发检查（`existingRunningBatch` 查询）仍在事务外。这是一个 TOCTOU 问题，但属于独立缺陷，不在本次修复范围内
- `Tx` 类型在 `resolve.ts` 中定义并导出，如果未来更多函数需要事务支持，可考虑提取到 `@/db/types`

## 4. Blast Radius（影响范围）

### 直接影响
- `POST /api/eval/run` — 配置查询和 run 创建现在在事务中执行
- `POST /api/eval/batch` — 配置查询、batch 创建和 N 个 run 创建循环现在在事务中执行
- `resolveEditingVersionId` — 新增可选 `conn` 参数

### 间接影响
无。`resolveEditingVersionId` 的 `conn` 参数默认为 `db`，所有现有调用方行为不变。

### 不影响
- Eval Run 的执行流程（Inngest worker）——事务仅影响创建阶段
- 其他 eval API（results、retry-failed 等）
- `resolveEditingVersionId` 的其他调用方（chat route、version route 等）——默认参数向后兼容

## 5. Verification（验证方式）

### 静态检查
- `make typecheck`：通过
- `make test`：122 文件通过，1390 用例通过

### 正向验证
此缺陷为代码结构级并发一致性问题，正向验证通过代码审计确认：
1. `run/route.ts` 中配置查询（L61-142）+ run 创建全部在 `db.transaction()` 内
2. `batch/route.ts` 中配置查询（L68-179）+ batch 创建 + N 个 run 创建循环全部在 `db.transaction()` 内
3. `resolveEditingVersionId` 在事务内调用时使用传入的 `tx`，不再使用顶层 `db`

### 回归验证
- `create-run.test.ts`：14 个用例全部通过，包括正常创建、缺配置 400、并发 409 等场景
- 全量测试套件：1390 用例无回归

## 过程备注

- [确认] 事务内不能 `return Response`，改用 throw/catch 模式。`ConfigError` 作为文件内部 sentinel class，不需要导出
- [确认] `resolveEditingVersionId` 的 `conn` 参数类型为 `Tx | typeof db`，Drizzle 的 `PgTransaction` 和 `PostgresJsDatabase` 在 select/insert 接口上结构兼容
- [确认] 测试 mock 只需给 `db` 添加 `transaction` 方法，委托到同一套 mock 链即可，无需重写全部测试
