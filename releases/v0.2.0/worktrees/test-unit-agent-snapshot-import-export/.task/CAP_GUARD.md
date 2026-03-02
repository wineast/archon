# 需求守护规约：Agent 导入导出与快照单元测试

> 生成时间：2026-03-02 21:35
> 关联需求：[REQ.md](REQ.md)
> 关联实现：[IMPL_REPORT.md](IMPL_REPORT.md)
> 关联验收：[ACCEPT_REPORT.md](ACCEPT_REPORT.md)
> 分支：`dev-test-unit-agent-snapshot-import-export-20260302`

## 1. Capability（能力宣言）

Agent 导入导出链路的核心模块（buildSnapshot、restoreSnapshot、copyVersionResources、POST /api/agents/import）具备自动化单元测试守护，确保 19 表并行查询、14 步依赖插入、多层 ID 映射链的正确性不因后续修改而退化。

## 2. Criteria Matrix（标准矩阵）

### buildSnapshot

| # | 验收标准 | Given | When | Then | Level | 测试位置 |
|---|----------|-------|------|------|-------|----------|
| C-1 | Agent 不存在抛异常 | agent 查询返回空 | 调用 buildSnapshot | 抛出 "Agent not found" | Unit | snapshot.test.ts:174 |
| C-2 | 正常路径输出完整结构 | mock 返回 tools/functions/schemas/datasets | 调用 buildSnapshot | 输出包含所有资源类型且字段正确 | Unit | snapshot.test.ts:179 |
| C-3 | componentKey 映射 | tool 有 componentId，组件存在 | 调用 buildSnapshot | tool.componentKey = 组件 key | Unit | snapshot.test.ts:198 |
| C-4 | componentKey 缺失降级 | tool 有 componentId，组件不存在 | 调用 buildSnapshot | tool.componentKey = null | Unit | snapshot.test.ts:208 |
| C-5 | wiki parentKey 映射 | 子文档有 parentId 指向父文档 | 调用 buildSnapshot | child.parentKey = 父文档 key | Unit | snapshot.test.ts:217 |
| C-6 | 测试用例按工具分组 | 两个工具各有测试用例 | 调用 buildSnapshot | 每个工具的 testCases 数组分别包含对应用例 | Unit | snapshot.test.ts:230 |
| C-7 | 池资源引用解析+缺失跳过 | 2 个资源引用，其中 1 个池资源查不到 | 调用 buildSnapshot | 只输出可解析的 1 个 resourceRef | Unit | snapshot.test.ts:251 |
| C-8 | objectType schemaKey 映射 | objectType 有 schemaId 指向 schema | 调用 buildSnapshot | objectType.schemaKey = schema key | Unit | snapshot.test.ts:271 |

### restoreSnapshot

| # | 验收标准 | Given | When | Then | Level | 测试位置 |
|---|----------|-------|------|------|-------|----------|
| C-9 | objectRelations 先于其他表删除 | 空快照 | 调用 restoreSnapshot | deleteCalls[0] = "objectRelations" | Unit | snapshot.test.ts:287 |
| C-10 | wiki 两轮插入 | wiki 有 parent-child 关系 | 调用 restoreSnapshot | 第一轮 parentId=null，第二轮 update parentId | Unit | snapshot.test.ts:296 |
| C-11 | 池组件解析 | tool.componentKey 匹配池组件 | 调用 restoreSnapshot | tool.componentId = 池组件 ID | Unit | snapshot.test.ts:325 |
| C-12 | schemaKey→schemaId 映射 | objectType.schemaKey 匹配新插入 schema | 调用 restoreSnapshot | objectType.schemaId = 新 schema ID | Unit | snapshot.test.ts:352 |
| C-13 | 资源引用通过 key 恢复 | resourceRef 有 resourceKey | 调用 restoreSnapshot | 插入 agentResourceRefs 使用池资源 ID | Unit | snapshot.test.ts:378 |
| C-14 | 池资源不存在时跳过引用 | resourceKey 查不到池资源 | 调用 restoreSnapshot | 不插入 agentResourceRefs | Unit | snapshot.test.ts:398 |
| C-15 | 空快照无插入 | 所有资源数组为空 | 调用 restoreSnapshot | deleteCalls > 0, insertCalls = 0 | Unit | snapshot.test.ts:415 |

### copyVersionResources

| # | 验收标准 | Given | When | Then | Level | 测试位置 |
|---|----------|-------|------|------|-------|----------|
| C-16 | datasets 复制带新 versionId | 源版本有 1 个 dataset | 调用 copyVersionResources | 插入 dataset 的 versionId = tgt-v | Unit | copy-resources.test.ts:141 |
| C-17 | objectRelations 过滤无效引用 | 一个有效关系+一个 targetType 缺失的关系 | 调用 copyVersionResources | 只插入 1 个有效关系 | Unit | copy-resources.test.ts:159 |
| C-18 | componentId 池资源回退 | tool 引用不在 compIdMap 中的 componentId | 调用 copyVersionResources | 保留原 componentId | Unit | copy-resources.test.ts:187 |
| C-19 | 父资源删除时子用例不复制 | 一个用例属于已存在工具，另一个属于已删除工具 | 调用 copyVersionResources | 只插入 1 个测试用例 | Unit | copy-resources.test.ts:213 |
| C-20 | 资源引用直通复制 | 池资源引用有 resourceId | 调用 copyVersionResources | resourceId 不变，versionId 更新 | Unit | copy-resources.test.ts:241 |
| C-21 | wiki 两轮 parentId 更新 | wiki 有 parent-child 关系 | 调用 copyVersionResources | 先 null 插入，再 update parentId | Unit | copy-resources.test.ts:261 |

### import route

| # | 验收标准 | Given | When | Then | Level | 测试位置 |
|---|----------|-------|------|------|-------|----------|
| C-22 | orgId 缺失 400 | 请求无 orgId 查询参数 | POST /api/agents/import | 返回 400，error 包含 "orgId" | Unit | import-route.test.ts:182 |
| C-23 | blobUrl 缺失 400 | body 无 blobUrl | POST /api/agents/import | 返回 400，error 包含 "blobUrl" | Unit | import-route.test.ts:195 |
| C-24 | blobUrl 非字符串 400 | body.blobUrl = 123 | POST /api/agents/import | 返回 400 | Unit | import-route.test.ts:202 |
| C-25 | 权限拒绝透传 | requireOrgRole 返回 403 | POST /api/agents/import | 返回 403 | Unit | import-route.test.ts:209 |
| C-26 | ZIP 解析失败+blob 清理 | fetch 返回 500 | POST /api/agents/import | 返回 400，mockDel 被调用 | Unit | import-route.test.ts:219 |
| C-27 | validateExportData 失败 400 | validate 返回 false | POST /api/agents/import | 返回 400，error 包含 "Invalid" | Unit | import-route.test.ts:230 |
| C-28 | 正常导入 201 | 完整 mock 链路 | POST /api/agents/import | 返回 201，含 agent ID + orgSlug | Unit | import-route.test.ts:239 |
| C-29 | restoreSnapshot 正确调用 | 正常导入完成 | POST /api/agents/import | restoreSnapshot 被调用，参数含 agentId/versionId/snapshot | Unit | import-route.test.ts:249 |
| C-30 | ensureUniqueSlug 正确调用 | 正常导入完成 | POST /api/agents/import | ensureUniqueSlug 被调用，参数含 slug 和 orgId | Unit | import-route.test.ts:259 |
| C-31 | 临时 blob 清理 | 正常导入完成 | POST /api/agents/import | mockDel 被调用，参数为 blobUrl | Unit | import-route.test.ts:265 |

## 3. Journey Test（旅程测试）

### Journey 1: 开发者修改后验证

- **Who**: 维护 Agent 导入导出功能的开发者
- **Level**: Unit（`make test`）
- **Flow**:
  1. 修改 snapshot.ts / copy-resources.ts / import route.ts
  2. 执行 `make test`
  3. 31 个守护测试全部通过 → 改动未破坏核心链路
  4. 若有测试失败 → 定位到具体断言，修复回归
- **关键断言**: `make test` 退出码 0，31 个新增测试无失败

本任务的交付物本身就是单元测试，旅程测试 = 运行测试套件本身。不需要额外的 E2E 旅程测试。

## 4. Constraint Guard（约束守卫）

| # | 约束 | Given | When | Then | Level |
|---|------|-------|------|------|-------|
| CG-1 | 不修改被测代码 | 本次变更 | 检查 git diff | snapshot.ts/copy-resources.ts/route.ts 无修改 | 流程约束（git 验证） |
| CG-2 | 不修改现有测试 | 本次变更 | 检查 git diff | 已有测试文件无修改 | 流程约束（git 验证） |
| CG-3 | 不引入新依赖 | package.json | 检查 diff | 无新增 dependencies | 流程约束（git 验证） |

约束守卫为流程级约束，通过 git diff 验证而非测试代码。已在验收报告中确认。

## 5. Degradation Fence（退化围栏）

| # | Known Gap | 底线 | Given | When | Then | Level |
|---|-----------|------|-------|------|------|-------|
| DF-1 | deletedAt 过滤无法通过 mock 验证 | buildSnapshot 正常路径测试持续通过 | mock 返回已过滤数据 | 调用 buildSnapshot | 输出结构正确 | Unit（C-2 已覆盖） |
| DF-2 | route 版本标记回退未测试 | 正常导入 201 测试持续通过 | 有 isEditing/isPublished 的正常数据 | POST import | 返回 201 | Unit（C-28 已覆盖） |
| DF-3 | route ZIP 文件缺失跳过未测试 | 无文件的正常导入测试持续通过 | export data 无 files | POST import | 返回 201 | Unit（C-28 已覆盖） |

三个 Known Gap 的底线均已被正常路径测试覆盖——如果正常路径也坏了，说明跌破底线。

## 6. Coverage Matrix（覆盖矩阵）

| 来源 | 测试数量 | 文件 | 层级 | 状态 |
|------|----------|------|------|------|
| C-1~C-8 (buildSnapshot) | 8 | snapshot.test.ts | Unit | ✅ |
| C-9~C-15 (restoreSnapshot) | 7 | snapshot.test.ts | Unit | ✅ |
| C-16~C-21 (copyVersionResources) | 6 | copy-resources.test.ts | Unit | ✅ |
| C-22~C-31 (import route) | 10 | import-route.test.ts | Unit | ✅ |
| Journey-1 | — | `make test` | Unit | ✅ |
| CG-1~CG-3 | — | git diff | 流程 | ✅ |
| DF-1~DF-3 | — | C-2, C-28 | Unit | ✅ |
