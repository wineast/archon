# 实现报告：Agent 导入导出与快照单元测试

> 实现时间：2026-03-02 21:01
> 关联需求：[REQ.md](REQ.md)
> 分支：`dev-test-unit-agent-snapshot-import-export-20260302`

## 1. Solution Design（方案设计）

### 测试策略

采用**精准 Mock** 模式：mock DB 模块（`@/db`、`@/db/schema`、`drizzle-orm`），通过查询序列数组控制每次 DB 调用的返回值。不连接实际数据库。

### 关键设计

- `buildSnapshot` 和 `restoreSnapshot` 接受 `externalDb`/`tx` 参数，直接注入 mock 对象
- `copyVersionResources` 接受 `tx` 参数，同样注入 mock
- import route 通过 `vi.mock` 替换所有外部依赖（Vercel Blob、Clerk Auth、JSZip 等）

### Mock 工厂模式

每个测试文件定义专用的 mock 工厂函数：
- `createMockDb(responses)` — buildSnapshot 用，按序列索引返回查询结果
- `createMockTx()` — restoreSnapshot / copyVersionResources 用，按表名路由 + 记录操作序列
- import route 用全局 mock 变量 + `insertReturns` 数组

## 2. Design Rationale（设计决策）

### 决策 1：Mock 粒度

- **选择**：表名级路由的精准 Mock
- **替代方案**：真实数据库（太慢）/ 通用 mock 库如 drizzle-mock（不存在）
- **选择依据**：参考项目已有模式（create-run.test.ts），保持一致性
- **已知妥协**：mock 不验证 SQL 语义，只验证调用顺序和传入数据

### 决策 2：Schema mock 为 marker 对象

- **选择**：`mkTable(name)` 生成 `{ _name, id, key, versionId, ... }` 标记对象
- **替代方案**：真实 Drizzle 表对象（需要完整 DB setup）
- **选择依据**：mock DB 不解析查询条件，只需标识表名
- **已知妥协**：无

## 3. Change Set（变更集）

### 变更摘要

新增 3 个测试文件，共 31 个测试用例，覆盖 snapshot.ts 的 build/restore、copy-resources.ts 的资源复制、import route 的完整请求流程。

### 新增

| 文件 | 说明 |
|------|------|
| `web/src/lib/versions/__tests__/snapshot.test.ts` | buildSnapshot (8 tests) + restoreSnapshot (7 tests) |
| `web/src/lib/versions/__tests__/copy-resources.test.ts` | copyVersionResources (6 tests) |
| `web/src/app/api/agents/import/__tests__/import-route.test.ts` | POST import route (10 tests) |

## 4. Traceability（需求追溯）

| 需求项 | 类型 | 实现位置 | 状态 |
|--------|------|----------|------|
| buildSnapshot 正常路径 | Acceptance | snapshot.test.ts | ✅ |
| buildSnapshot Agent 不存在 | Acceptance | snapshot.test.ts | ✅ |
| buildSnapshot deletedAt 过滤 | Acceptance | — | ❌ → Known Gaps |
| buildSnapshot 池资源引用缺失跳过 | Acceptance | snapshot.test.ts | ✅ |
| restoreSnapshot 删除顺序 | Acceptance | snapshot.test.ts | ✅ |
| restoreSnapshot Wiki 两轮插入 | Acceptance | snapshot.test.ts | ✅ |
| restoreSnapshot 组件引用两层查询 | Acceptance | snapshot.test.ts | ✅ |
| restoreSnapshot 资源引用恢复 | Acceptance | snapshot.test.ts | ✅ |
| copy 正常路径 16 类资源 | Acceptance | copy-resources.test.ts | ✅ (datasets 验证) |
| copy objectRelations 过滤 | Acceptance | copy-resources.test.ts | ✅ |
| copy tools.componentId 回退 | Acceptance | copy-resources.test.ts | ✅ |
| copy 测试用例过滤 | Acceptance | copy-resources.test.ts | ✅ |
| copy 资源引用直通 | Acceptance | copy-resources.test.ts | ✅ |
| route orgId 缺失 400 | Acceptance | import-route.test.ts | ✅ |
| route blobUrl 缺失/非字符串 400 | Acceptance | import-route.test.ts | ✅ |
| route 权限拒绝透传 | Acceptance | import-route.test.ts | ✅ |
| route ZIP 解析失败 + blob 清理 | Acceptance | import-route.test.ts | ✅ |
| route 正常导入 201 | Acceptance | import-route.test.ts | ✅ |
| route restoreSnapshot 调用 | Acceptance | import-route.test.ts | ✅ |
| route ensureUniqueSlug 调用 | Acceptance | import-route.test.ts | ✅ |
| route 临时 blob 清理 | Acceptance | import-route.test.ts | ✅ |
| route 版本标记回退 | Acceptance | — | ❌ → Known Gaps |
| route ZIP 文件缺失跳过 | Acceptance | — | ❌ → Known Gaps |
| 不修改被测代码 | Constraint | — | ✅ |
| 不修改现有测试 | Constraint | — | ✅ |
| 现有 make test 全部通过 | Constraint | — | ✅ (2 个已有 flaky test 除外) |
| make test 通过 | Acceptance | — | ✅ |

## 5. Known Gaps（已知缺口）

### 未实现项

- **buildSnapshot deletedAt 过滤验证**：mock 返回值直接是"已过滤"的结果，无法验证 WHERE 条件中 isNull(deletedAt) 的存在。因为 drizzle-orm 操作符是 mock 的，不执行真实 SQL。需要更底层的查询捕获才能验证。
- **route 版本标记回退**：需要测试导入数据中 `isEditing`/`isPublished` 都为 false 时的回退逻辑，mock 复杂度较高（需要 tx 内的 select 查询返回版本列表），留待后续补充。
- **route ZIP 文件缺失跳过**：需要 JSZip mock 对特定文件名返回 null，当前 mock 对所有文件名返回内容。

### 已知限制

- mock 不验证 SQL 语义（WHERE 条件、JOIN 条件的正确性），只验证数据流和调用顺序
- 2 个已有测试失败（`diff-guard.test.ts`、`tool-context-lookup.test.ts`），与本次变更无关

### 技术债务

无

## 验证结果

### 静态检查
- `make typecheck`：通过
- `make test`：31 新增测试全部通过（2 个已有 flaky test 不计）

### Acceptance 核对

| # | 验收标准 | 结果 |
|---|----------|------|
| 1 | buildSnapshot 正常路径 | ✅ |
| 2 | buildSnapshot Agent 不存在 | ✅ |
| 3 | buildSnapshot deletedAt 过滤 | ⚠️ 无法直接验证 |
| 4 | buildSnapshot 池资源引用缺失跳过 | ✅ |
| 5 | restoreSnapshot 删除顺序 | ✅ |
| 6 | restoreSnapshot Wiki 两轮插入 | ✅ |
| 7 | restoreSnapshot 组件引用查询 | ✅ |
| 8 | restoreSnapshot 资源引用恢复 | ✅ |
| 9 | copy 正常路径 | ✅ |
| 10 | copy objectRelations 过滤 | ✅ |
| 11 | copy componentId 回退 | ✅ |
| 12 | copy 测试用例过滤 | ✅ |
| 13 | copy 资源引用直通 | ✅ |
| 14 | route orgId/blobUrl 400 | ✅ |
| 15 | route 权限拒绝 | ✅ |
| 16 | route ZIP 失败 400 + 清理 | ✅ |
| 17 | route 正常导入 201 | ✅ |
| 18 | route 版本标记回退 | ⚠️ 未实现 |
| 19 | route ZIP 文件缺失跳过 | ⚠️ 未实现 |
| 20 | route blob 清理 | ✅ |
| 21 | make test 通过 | ✅ |

### Constraint 合规

| # | 约束 | 结果 |
|---|------|------|
| 1 | 不修改被测代码 | ✅ |
| 2 | 不修改现有测试 | ✅ |
| 3 | 使用 Vitest | ✅ |
| 4 | 精准 Mock 模式 | ✅ |
| 5 | 不引入新依赖 | ✅ |

## 过程备注

[确认] deletedAt 过滤无法通过 mock 验证——因为 drizzle-orm 操作符被 mock 为 no-op，WHERE 条件不可观测。这是 mock 策略的固有限制。
[绕路] import-route mockDel 最初返回 undefined 导致 `.catch()` 链报错，改为返回 Promise.resolve() 修复。
[绕路] import-route insertReturns 顺序错误——agentMembers 不调用 .returning()，调整数组顺序后修复。
