# 修复报告：版本操作接口添加 agentId 归属校验

> 修复时间：2026-03-01
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-version-publish-missing-agent-ownership-check-20260301`

## 1. Root Cause（根因）

### 为什么坏了
5 个版本操作接口在查询 `agentVersions` 表时，WHERE 子句只用了 `eq(agentVersions.id, versionId)` 按主键定位，未加 `eq(agentVersions.agentId, agentId)` 验证 version 归属。

`requireAgentRole(agentId, ...)` 只校验用户对路径参数中 `agentId` 对应 Agent 的权限，不涉及 `versionId` 的归属关系。两层校验之间存在缝隙：权限校验通过 ≠ 资源归属正确。

### 因果链
1. 攻击者构造请求 `POST /api/agents/{agentA}/versions/{agentB-versionId}/publish`
2. → `requireAgentRole(agentA, "admin")` 通过（用户确实有 agentA 的 admin 权限）
3. → `where(eq(agentVersions.id, agentB-versionId))` 查到 Agent B 的 version（主键全局唯一，不按 agent 隔离）
4. → 将 Agent B 的 version 设为 Agent A 的 `publishedVersionId`

## 2. Change（变更）

### 修改摘要
在所有 5 个受影响接口的 version 查询 WHERE 子句中，将单条件 `eq(agentVersions.id, versionId)` 改为双条件 `and(eq(agentVersions.id, versionId), eq(agentVersions.agentId, agentId))`，确保 version 必须归属于路径中的 agent。

### 修改明细
| 文件 | 改动 | 说明 |
|------|------|------|
| `versions/[versionId]/publish/route.ts:4,22-24` | `eq(id)` → `and(eq(id), eq(agentId))` | publish 接口添加归属校验 |
| `versions/[versionId]/rollback/route.ts:4,27-29` | 同上 | rollback 接口添加归属校验 |
| `versions/[versionId]/route.ts:4,32-34` | 同上（GET） | version detail 接口添加归属校验 |
| `versions/[versionId]/route.ts:70-74` | `delete` 的 WHERE 同样添加 `agentId` | DELETE 接口添加归属校验 |
| `versions/switch/route.ts:4,35-41` | `eq(id, targetVersionId)` → `and(eq(id), eq(agentId))` | switch 接口添加归属校验 |

## 3. Rationale（决策依据）

### 为什么选择此方案
在 SQL WHERE 子句中直接添加 `agentId` 条件是最简单、最安全的方案：
- 零额外查询开销（复合条件在一次查询中完成）
- 逻辑清晰：version 不属于当前 agent → 视为"not found"返回 404
- 与项目中其他接口的安全模式一致（如 `versions/route.ts` 的 GET 列表已用 `eq(agentVersions.agentId, agentId)`）

### 考虑过的替代方案
| 方案 | 未采用原因 |
|------|-----------|
| 先查 version 再判断 `version.agentId !== agentId` 返回 403 | 多一次分支判断，且 403 会向攻击者泄露"该 version 存在但不属于你"的信息，404 更安全 |
| 提取公共 `verifyVersionOwnership()` 中间件 | 仅 5 处使用且各接口查询字段不同，抽象收益低于维护成本 |

### 已知局限
无。此修复是纯防御性加固，不改变正常操作的行为。

## 4. Blast Radius（影响范围）

### 直接影响
- 5 个版本操作接口：publish、rollback、GET detail、DELETE、switch
- 攻击者传入不属于当前 agent 的 versionId 时，将收到 404 而非执行操作

### 间接影响
无。正常使用场景中 versionId 始终属于当前 agent，添加 agentId 条件不改变正常查询结果。

### 不影响
- 版本列表 `GET /versions`（已有 agentId 条件）
- 创建版本 `POST /versions`（已有 agentId 条件）
- `by-ref` 和 `diff` 接口（通过 lib 函数间接校验）
- 所有非版本相关的 API

## 5. Verification（验证方式）

### 静态检查
- `make typecheck`：通过
- `make test`：通过（113 文件，1284 用例）

### 正向验证
代码审查确认所有 5 个接口的 WHERE 子句已包含 `and(eq(id, versionId), eq(agentId, agentId))`。

攻击场景下行为变化：
- 修复前：`POST /agents/{A}/versions/{B-version}/publish` → 200 OK（越权成功）
- 修复后：同请求 → 404 Version not found（归属校验阻止）

### 回归验证
正常场景下行为不变：
- `POST /agents/{A}/versions/{A-version}/publish` → 200 OK（正常发布）
- `GET /agents/{A}/versions/{A-version}` → 200 + version detail（正常查看）
- `DELETE /agents/{A}/versions/{A-version}` → 200 OK（正常删除）

## 过程备注

[确认] DELETE 接口的 `where` 也需要添加 agentId，虽然之前有"不能删除已发布版本"的保护逻辑，但该逻辑比对的是 agentA 的 publishedVersionId，对跨 agent 场景无效。
