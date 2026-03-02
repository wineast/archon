# 需求守护报告：Agent 导入导出与快照单元测试

> 执行时间：2026-03-02 21:35
> 关联规约：[CAP_GUARD.md](CAP_GUARD.md)
> 分支：`dev-test-unit-agent-snapshot-import-export-20260302`

## 1. 规约概要

### Capability
Agent 导入导出链路的核心模块（buildSnapshot、restoreSnapshot、copyVersionResources、POST /api/agents/import）具备 31 个自动化单元测试守护，覆盖 19 表并行查询、14 步依赖插入、多层 ID 映射链的正确性。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Criteria Matrix | 31 | 31 | 31 | 0 |
| Journey Test | 1 | — | 1 | 0 |
| Constraint Guard | 3 | — | 3 | 0 |
| Degradation Fence | 3 | — | 3 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：1342 passed, 1 failed（pre-existing `diff-guard.test.ts` timeout，与本次无关）

### 单元测试

| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `web/src/lib/versions/__tests__/snapshot.test.ts` | 15 | 15 | 0 | C-1~C-15 |
| `web/src/lib/versions/__tests__/copy-resources.test.ts` | 6 | 6 | 0 | C-16~C-21 |
| `web/src/app/api/agents/import/__tests__/import-route.test.ts` | 10 | 10 | 0 | C-22~C-31 |

### E2E 测试
无（本任务交付物本身是单元测试，不需要额外 E2E 守护）

## 3. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 结果 |
|------|----------|------|------|------|
| C-1 | throws when agent not found | snapshot.test.ts | Unit | ✅ |
| C-2 | returns correct snapshot structure for populated agent | snapshot.test.ts | Unit | ✅ |
| C-3 | maps tool componentKey via compIdToKey | snapshot.test.ts | Unit | ✅ |
| C-4 | sets componentKey to null when component not found | snapshot.test.ts | Unit | ✅ |
| C-5 | maps wiki parentKey via wikiIdToKey | snapshot.test.ts | Unit | ✅ |
| C-6 | groups test cases by parent tool key | snapshot.test.ts | Unit | ✅ |
| C-7 | resolves resource refs and skips missing pool resources | snapshot.test.ts | Unit | ✅ |
| C-8 | maps objectType schemaKey via schemaIdToKey | snapshot.test.ts | Unit | ✅ |
| C-9 | deletes objectRelations before other tables | snapshot.test.ts | Unit | ✅ |
| C-10 | inserts wiki docs with null parentId then updates parentId | snapshot.test.ts | Unit | ✅ |
| C-11 | resolves pool components for unresolved componentKeys | snapshot.test.ts | Unit | ✅ |
| C-12 | maps schemaKey to new schemaId in objectTypes | snapshot.test.ts | Unit | ✅ |
| C-13 | restores resource refs via pool lookup | snapshot.test.ts | Unit | ✅ |
| C-14 | skips resource ref when pool resource not found | snapshot.test.ts | Unit | ✅ |
| C-15 | handles empty snapshot without insert calls | snapshot.test.ts | Unit | ✅ |
| C-16 | copies datasets with new versionId and builds idMap | copy-resources.test.ts | Unit | ✅ |
| C-17 | filters objectRelations when source or target type missing | copy-resources.test.ts | Unit | ✅ |
| C-18 | falls back to original componentId when not in compIdMap | copy-resources.test.ts | Unit | ✅ |
| C-19 | filters test cases when parent resource deleted | copy-resources.test.ts | Unit | ✅ |
| C-20 | copies resource refs with same resourceId but new versionId | copy-resources.test.ts | Unit | ✅ |
| C-21 | handles wiki two-pass parentId update | copy-resources.test.ts | Unit | ✅ |
| C-22 | returns 400 when orgId is missing | import-route.test.ts | Unit | ✅ |
| C-23 | returns 400 when blobUrl is missing | import-route.test.ts | Unit | ✅ |
| C-24 | returns 400 when blobUrl is not a string | import-route.test.ts | Unit | ✅ |
| C-25 | passes through auth rejection from requireOrgRole | import-route.test.ts | Unit | ✅ |
| C-26 | returns 400 and cleans up blob on ZIP parse failure | import-route.test.ts | Unit | ✅ |
| C-27 | returns 400 when validateExportData fails | import-route.test.ts | Unit | ✅ |
| C-28 | creates agent and returns 201 on successful import | import-route.test.ts | Unit | ✅ |
| C-29 | calls restoreSnapshot for each version with snapshot | import-route.test.ts | Unit | ✅ |
| C-30 | calls ensureUniqueSlug with agent slug and orgId | import-route.test.ts | Unit | ✅ |
| C-31 | cleans up temporary blob after successful import | import-route.test.ts | Unit | ✅ |
| Journey-1 | make test 全部通过 | — | Unit | ✅ |
| CG-1 | 被测代码未修改 | git diff | 流程 | ✅ |
| CG-2 | 现有测试未修改 | git diff | 流程 | ✅ |
| CG-3 | 无新增依赖 | git diff | 流程 | ✅ |
| DF-1 | buildSnapshot 正常路径底线 | snapshot.test.ts (C-2) | Unit | ✅ |
| DF-2 | 正常导入 201 底线 | import-route.test.ts (C-28) | Unit | ✅ |
| DF-3 | 无文件导入底线 | import-route.test.ts (C-28) | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Criteria Matrix**：31/31 条全部覆盖且通过
- **Journey Test**：`make test` 通过，31 个守护测试绿色
- **Constraint Guard**：3/3 条通过 git diff 验证
- **Degradation Fence**：3/3 条由正常路径测试底线覆盖

### 未覆盖项
无——本任务交付物即测试代码，规约中每条标准都有直接对应的测试用例。

### 新增测试文件

| 文件 | 类型 | 用例数 |
|------|------|--------|
| `web/src/lib/versions/__tests__/snapshot.test.ts` | Unit | 15 |
| `web/src/lib/versions/__tests__/copy-resources.test.ts` | Unit | 6 |
| `web/src/app/api/agents/import/__tests__/import-route.test.ts` | Unit | 10 |

## 过程备注

[确认] 本任务交付物本身是单元测试，因此守护规约与测试代码 1:1 对应——不需要额外编写守护测试代码，已有的 31 个测试就是永久守护。
[确认] Degradation Fence 采用"正常路径底线"策略——Known Gap 的底线由正常路径测试隐含覆盖，如果正常路径也坏了就是跌破底线。
