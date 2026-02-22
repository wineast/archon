# 版本系统

## 概述

每个 Agent 支持多版本管理。资源表通过 `versionId` 列直接关联版本，多版本数据在数据库中共存。切换版本只需修改指针（`editingVersionId` / `publishedVersionId`），零数据操作。

## 核心概念

### 版本指针

`agents` 表有两个版本指针：

| 字段 | 说明 |
|------|------|
| `editingVersionId` | 当前正在编辑的版本，Build 页面使用此版本 |
| `publishedVersionId` | 当前已发布的版本，Embed Chat 使用此版本 |

### versionId 列

所有配置类资源表都有 `versionId` 列，分两种模式：

**Pool 表（7 个，agentId 可空，versionId nullable）**：
tools, components, functions, datasets, wikiDocuments, schemas, mcpServers

- 池资源：`agentId = NULL, versionId = NULL`
- Agent 私有资源：`agentId != NULL, versionId != NULL`
- CHECK 约束：`agent_id IS NULL OR version_id IS NOT NULL`

**Agent 专属表（9 个，versionId NOT NULL）**：
modelConfigs, chatConfigs, evalCases, evalJudgeConfigs, skills, objectTypes, objectRelations, agentResourceRefs, memoryConfigs

### 运行时数据（不版本化）

以下表不含 versionId，属于运行时产生的数据：

- `memories` — 对话中提取的记忆内容
- `chatSessions` / `messages` — 对话历史
- `objectInstances` / `objectLinks` — 本体实例数据
- `*TestRuns` / `*TestRunResults` — 测试执行结果
- `evalRuns` / `evalRunResults` — 评测执行结果
- `usageRecords` / `runtimeEvents` — 用量和事件追踪

## 版本操作

| 操作 | API | 行为 |
|------|-----|------|
| 创建版本 | `POST /api/agents/[id]/versions` | insert version → copyVersionResources → update editingVersionId |
| 切换版本 | `POST /api/agents/[id]/versions/switch` | update editingVersionId（一行 SQL） |
| 发布版本 | `POST /api/agents/[id]/versions/[versionId]/publish` | update publishedVersionId（一行 SQL） |
| 回滚版本 | `POST /api/agents/[id]/versions/[versionId]/rollback` | update editingVersionId（等价于切换） |
| 删除版本 | `DELETE /api/agents/[id]/versions/[versionId]` | delete row（FK CASCADE 自动清理所有资源行） |

## 版本复制引擎

创建新版本时，`copyVersionResources(agentId, sourceVersionId, targetVersionId, tx)` 按 FK 依赖顺序复制所有资源：

1. datasets
2. schemas (+schemaTestCases)
3. objectTypes (→ schemas)
4. objectRelations (→ objectTypes)
5. components (+componentTestCases)
6. tools (+toolTestCases, → components)
7. functions (+functionTestCases)
8. wikiDocuments (两遍：先 parentId=null，再更新 parentId)
9. modelConfigs
10. chatConfigs
11. evalCases
12. evalJudgeConfigs
13. mcpServers
14. skills
15. memoryConfigs
16. agentResourceRefs (Pool 引用，resourceId 不变)

复制时维护 oldId→newId 映射表，处理跨资源 FK 引用（tool.componentId、objectType.schemaId、objectRelation.sourceTypeId/targetTypeId、wikiDocuments.parentId）。

**不复制**：memories（运行时）、testRuns（运行时）、objectInstances/objectLinks（运行时）。

## versionId 解析

后端从 `agents.editingVersionId` 自动解析 versionId，前端 SWR hooks 无需修改。

```ts
import { resolveEditingVersionId } from "@/lib/versions/resolve";

const versionId = await resolveEditingVersionId(agentId);
```

所有资源查询函数（`getAgentTools`、`getAgentDatasets` 等）均接受 `versionId` 参数：

```ts
const tools = await getAgentTools(agentId, versionId);
const datasets = await getAgentDatasets(agentId, versionId);
```

## Snapshot（快照）

Snapshot 是版本资源的序列化表示，**仅用于导出/导入**。`agentVersions` 表不存储 snapshot 字段——所有快照实时从资源行构建。

- `buildSnapshot(agentId, versionId)` — 从 versionId 关联的资源行实时构建 snapshot JSON
- `restoreSnapshot(agentId, versionId, snapshot, tx)` — 从 snapshot JSON 还原为带 versionId 的资源行

## 导出/导入

- 导出：遍历所有版本，对每个版本调用 `buildSnapshot(agentId, versionId)` 实时生成 snapshot
- 导入：创建 agent → 逐个 insert agentVersions → 对每个版本调用 `restoreSnapshot(agentId, versionId, snapshot, tx)` 还原资源行
- snapshot JSON 格式不变，保持向后兼容

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/db/schema.ts` | 数据库 schema（所有 versionId 列定义） |
| `src/lib/versions/copy-resources.ts` | 版本复制引擎 |
| `src/lib/versions/resolve.ts` | versionId 解析工具 |
| `src/lib/versions/snapshot.ts` | 快照构建/恢复（用于导出/导入） |
| `src/lib/pool/queries.ts` | Pool 资源查询（按 versionId 过滤） |
