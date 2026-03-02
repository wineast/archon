# 缺陷报告：版本操作接口未校验 versionId 归属 agentId（跨 Agent 越权）

> 诊断时间：2026-03-01
> 环境：dev | 代码审查 | 分支 `dev-version-publish-missing-agent-ownership-check-20260301`

## 1. Delta（偏差）

### 期望行为（Should Be）
所有以 `/api/agents/[id]/versions/[versionId]` 为前缀的接口，在操作 version 前应校验 `version.agentId === 路径参数 agentId`，确保该 version 确实属于该 Agent。

### 实际行为（Is）
5 个接口的 version 查询仅用 `eq(agentVersions.id, versionId)`，未加 `eq(agentVersions.agentId, agentId)` 条件。攻击者可构造请求操作其他 Agent 的 version。

### 偏差描述
版本操作接口存在 IDOR（Insecure Direct Object Reference）漏洞——通过篡改路径中的 versionId 可以跨 Agent 越权操作版本。

## 2. Reproduction Path（复现路径）

### 环境与前置条件
- 系统：任意（API 级漏洞）
- 数据依赖：两个 Agent（A 和 B），各有至少一个 version
- 配置：用户对 Agent A 有 admin 权限

### 操作步骤
1. 获取 Agent B 的某个 versionId（通过 `GET /api/agents/{agentB}/versions` 或其他途径）
2. 构造请求 `POST /api/agents/{agentA}/versions/{agentB-versionId}/publish`
3. → Agent A 的 `publishedVersionId` 被设置为 Agent B 的 version

### 复现证据
代码审查直接确认，无需 UI 复现。关键代码片段见 Location 节。

## 3. Location（定位）

### 功能模块
版本管理 API（`/api/agents/[id]/versions/[versionId]/*`）

### 代码定位

**受影响接口（5 个）：**

| 接口 | 文件:行号 | 问题 |
|------|-----------|------|
| `POST publish` | `web/src/app/api/agents/[id]/versions/[versionId]/publish/route.ts:22` | WHERE 缺少 agentId |
| `POST rollback` | `web/src/app/api/agents/[id]/versions/[versionId]/rollback/route.ts:27` | WHERE 缺少 agentId |
| `GET [versionId]` | `web/src/app/api/agents/[id]/versions/[versionId]/route.ts:32` | WHERE 缺少 agentId |
| `DELETE [versionId]` | `web/src/app/api/agents/[id]/versions/[versionId]/route.ts:68` | WHERE 缺少 agentId |
| `POST switch` | `web/src/app/api/agents/[id]/versions/switch/route.ts:35` | WHERE 缺少 agentId |

**不受影响接口（4 个）：**
- `GET .../versions`（列表）：已用 `eq(agentVersions.agentId, agentId)` ✅
- `POST .../versions`（创建版本）：已用 `eq(agentVersions.agentId, agentId)` ✅
- `GET .../by-ref`：通过 `resolveVersionByRef(agentId, ref)` 间接校验 ✅
- `GET .../diff`：通过 `buildSnapshot(agentId, versionId)` 间接校验 ✅

### 根因分析

所有受影响接口的 version 查询模式相同——只按 `versionId` 主键查找，未加 `agentId` 归属条件：

```typescript
// publish/route.ts:19-23（其他接口同理）
const [version] = await db
  .select({ id: agentVersions.id })
  .from(agentVersions)
  .where(eq(agentVersions.id, versionId))  // ← 缺少 eq(agentVersions.agentId, agentId)
  .limit(1);
```

`requireAgentRole(agentId, "admin")` 仅校验用户对 agentId 对应 Agent 的权限，不涉及 versionId 归属校验。因此即使通过了权限检查，version 仍可能属于另一个 Agent。

## 4. Impact（影响）

### 严重度
主要（安全漏洞）

### 影响范围
所有多 Agent 环境下的用户（SaaS 和私有化部署均受影响）

### 影响描述
- **publish**：攻击者可将 Agent B 的 version 设为 Agent A 的发布版本，导致 Agent A 运行错误的配置
- **rollback**：攻击者可将 Agent A 的编辑指针切换到 Agent B 的 version
- **switch**：同 rollback
- **GET detail**：信息泄露——可查看其他 Agent 的 version 详情和 snapshot
- **DELETE**：攻击者可删除其他 Agent 的 version（且绕过了"不能删除已发布版本"的保护，因为该检查比对的是 agentA 的 publishedVersionId）

## 修复方向

在所有受影响接口的 version 查询 WHERE 子句中添加 `eq(agentVersions.agentId, agentId)` 条件，使用 `and()` 组合多个条件。

- **最小改动**：5 个文件，每个文件改动 1-3 行（WHERE 子句添加 `and` + `agentId` 条件）
- **风险**：无负面风险，纯安全加固
- **验收标准**：
  - Given 用户对 Agent A 有 admin 权限，When 构造请求操作 Agent B 的 versionId，Then 返回 404
  - Given 用户对 Agent A 有 admin 权限，When 操作 Agent A 自己的 versionId，Then 正常执行

## 过程备注

[确认] 通过代码审查同时发现 switch 接口虽然不在路径参数中传 versionId（而是 body 中的 targetVersionId），但存在完全相同的越权模式。
