# 测试守护规约：版本操作接口 versionId 归属校验（防 IDOR 越权）

> 生成时间：2026-03-01
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`dev-version-publish-missing-agent-ownership-check-20260301`

## 1. Invariant（不变量）

所有版本操作 API 的 version 查询 WHERE 子句必须包含 `agentVersions.agentId` 归属条件，使用 `and()` 组合多条件，确保 versionId 必须属于路径中的 agentId。

来源：DEFECT.md Delta 取反

## 2. Trigger Scenario（触发场景）

### Given
- 用户对 Agent A 有 admin 权限
- Agent B 存在一个 versionId（不属于 Agent A）

### When
- 调用 `POST /api/agents/{agentA}/versions/{agentB-versionId}/publish`

### Then
- 返回 404 Version not found（归属校验阻止越权）

**Level**: Unit（通过 mock DB 行为测试）
**来源**: DEFECT.md Path → 精简

## 3. Cause Anchor（根因锚点）

### 故障机制
WHERE 子句仅用 `eq(agentVersions.id, versionId)` 定位 version，未加 `eq(agentVersions.agentId, agentId)` 归属条件。UUID 全局唯一，任何有效 versionId 不分 agent 均命中。

### 锚点断言
4 个路由源文件中，version 查询相关代码必须包含 `agentVersions.agentId`，且 import 中包含 `and`。

**Level**: Unit（源码断言）
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level |
|---|------|------|-------|
| 1 | publish 接口包含 agentId 校验 | 验证报告 | Unit |
| 2 | rollback 接口包含 agentId 校验 | 验证报告 | Unit |
| 3 | GET [versionId] 接口包含 agentId 校验 | 验证报告 | Unit |
| 4 | DELETE [versionId] 接口包含 agentId 校验 | 验证报告 | Unit |
| 5 | switch 接口包含 agentId 校验 | 验证报告 | Unit |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level |
|---|------|------|------|-------|
| 1 | publish 正常路径 | 同 agent 的 versionId → 200 OK | FIX_REPORT Blast Radius | Unit |
| 2 | publish 越权路径 | 跨 agent 的 versionId → 404 | FIX_REPORT Blast Radius | Unit |

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 层级 | 状态 |
|---------|---------|------|------|
| Cause Anchor | 4 个路由文件源码包含 agentVersions.agentId | Unit | ⏳ |
| Cause Anchor | 4 个路由文件 import and() | Unit | ⏳ |
| Boundary #1-5 | 5 个接口逐一源码断言 | Unit | ⏳ |
| Trigger Scenario | publish 跨 agent versionId → 404 | Unit | ⏳ |
| Blast Shield #1 | publish 同 agent versionId → 200 | Unit | ⏳ |
| Blast Shield #2 | publish 跨 agent versionId → 404 | Unit | ⏳ |
