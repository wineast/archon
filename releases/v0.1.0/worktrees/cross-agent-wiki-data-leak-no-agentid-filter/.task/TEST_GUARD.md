# 测试守护规约：Wiki 查询 versionId 隔离

> 生成时间：2026-03-01 15:14
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`dev-cross-agent-wiki-data-leak-no-agentid-filter-20260301`

## 1. Invariant（不变量）

Wiki 查询（get/findByPrefix/search）只返回当前 versionId 对应的文档，不能跨 Agent/跨版本泄露数据。

来源：DEFECT.md Delta 取反

## 2. Trigger Scenario（触发场景）

### Given
createToolContext 传入 agentId 和 versionId，数据库中存在多个版本的 Wiki 文档

### When
调用 context.wiki.search("")、context.wiki.findByPrefix("prefix")、context.wiki.get(uuid)

### Then
仅返回当前 versionId 对应的 Wiki 文档，不返回其他版本的文档

**Level**: Unit（服务端函数，无法通过 E2E 触发）
**来源**: DEFECT.md Path → 精简

## 3. Cause Anchor（根因锚点）

### 故障机制
wiki.get/findByPrefix/search 的 SQL WHERE 子句缺少 `eq(wikiDocuments.versionId, versionId)` 条件

### 锚点断言
三个方法调用时，`eq()` 必须被调用并传入 `wikiDocuments.versionId` 列和实际 versionId 值

**Level**: Unit
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level |
|---|------|------|-------|
| 1 | versionId 为 undefined → 三个方法返回 null/[] 不查库 | VERIFY_REPORT.md Boundary | Unit |
| 2 | wiki.get() 传 UUID → UUID 路径也有 versionId 过滤 | VERIFY_REPORT.md Boundary | Unit |
| 3 | wiki.get() 传非 UUID key → key fallback 路径有 versionId 过滤 | VERIFY_REPORT.md Boundary | Unit |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level |
|---|------|------|------|-------|
| 1 | dataset.get() | 仍使用 getAgentDatasets(agentId, versionId) 正常工作 | FIX_REPORT Blast Radius | Unit |

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 层级 | 状态 |
|---------|---------|------|------|
| Cause Anchor | wiki.search() 查询包含 versionId 过滤 | Unit | ⏳ |
| Cause Anchor | wiki.findByPrefix() 查询包含 versionId 过滤 | Unit | ⏳ |
| Cause Anchor | wiki.get() UUID 路径包含 versionId 过滤 | Unit | ⏳ |
| Cause Anchor | wiki.get() key fallback 包含 versionId 过滤 | Unit | ⏳ |
| Boundary #1 | 无 versionId 时返回空不查库 | Unit | ⏳ |
| Boundary #2 | wiki.get() UUID 路径有 versionId 过滤 | Unit | ⏳ |
| Boundary #3 | wiki.get() key fallback 有 versionId 过滤 | Unit | ⏳ |
| Blast Shield #1 | dataset.get() 不受影响 | Unit | ⏳ |
