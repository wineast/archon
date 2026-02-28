# 版本系统

## 概述

每个 Agent 支持多版本管理。资源表通过 `versionId` 列直接关联版本，多版本数据在数据库中共存。切换版本只需修改指针（`editingVersionId` / `publishedVersionId`），零数据操作。

## 核心概念

### 版本指针

`agents` 表有两个版本指针：

| 字段 | 说明 |
|------|------|
| `editingVersionId` | 当前正在编辑的版本，Build 页面和草稿预览页使用此版本 |
| `publishedVersionId` | 当前已发布的版本，Chat 页面、Embed Chat 使用此版本 |

### versionId 列

所有配置类资源表都有 `versionId` 列，分两种模式：

**Pool 表（7 个，agentId 可空，versionId nullable）**：
tools, components, functions, datasets, wikiDocuments, schemas, mcpServers

- 池资源：`agentId = NULL, versionId = NULL`
- Agent 私有资源：`agentId != NULL, versionId != NULL`
- CHECK 约束：`agent_id IS NULL OR version_id IS NOT NULL`

**Agent 专属表（9 个，versionId NOT NULL）**：
modelConfigs, chatConfigs, evalCases, judgeConfigs, skills, objectTypes, objectRelations, agentResourceRefs, memoryConfigs

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
12. judgeConfigs
13. mcpServers
14. skills
15. memoryConfigs
16. agentResourceRefs (Pool 引用，resourceId 不变)

复制时维护 oldId→newId 映射表，处理跨资源 FK 引用（tool.componentId、objectType.schemaId、objectRelation.sourceTypeId/targetTypeId、wikiDocuments.parentId）。

**不复制**：memories（运行时）、testRuns（运行时）、objectInstances/objectLinks（运行时）。

## versionId 解析

后端通过 `mode` 参数区分编辑版本和发布版本：

```ts
import { resolveEditingVersionId, resolvePublishedVersionId, resolveVersionByMode } from "@/lib/versions/resolve";

// 直接使用
const editingId = await resolveEditingVersionId(agentId);   // throws if missing
const publishedId = await resolvePublishedVersionId(agentId); // throws if missing

// 按 mode 解析（推荐用于 API 路由）
const versionId = await resolveVersionByMode(agentId, mode); // returns null if published & missing
```

### 资源 API 的 mode / versionId 参数

资源 GET API（tools, components, chat-configs, model-configs, model-configs/active）支持两种版本选择方式：

**方式一：mode 参数**（按指针解析）
- 不传（默认）→ `resolveEditingVersionId`（Build 页面使用）
- `mode=published` → `resolvePublishedVersionId`（Chat 页面使用，未发布返回 404）

**方式二：versionId 参数**（直接指定版本）
- `versionId=<uuid>` → 直接使用该版本（版本聊天使用）
- 会校验 versionId 属于当前 agent

`versionId` 优先级高于 `mode`，两者同时传时以 `versionId` 为准。

前端 SWR hooks 通过 `VersionMode` 类型统一传递：

```ts
import type { VersionMode } from "@/lib/versions/mode";

const { tools } = useTools(agentId);                         // Build 页面（默认 editing）
const { tools } = useTools(agentId, "published");            // Chat 页面
const { tools } = useTools(agentId, { versionId: "uuid" }); // 版本聊天
```

### 聊天 API 的版本选择

`/api/chat` 支持三种模式，按优先级排序：

```ts
// 1. 版本聊天：指定 versionId（viewer+ 权限）
body: { agentId, sessionId, versionId: "uuid" }

// 2. 草稿预览：draft=true（editor 权限）
body: { agentId, sessionId, draft: true }

// 3. 正式聊天：默认 published（viewer+ 权限）
body: { agentId, sessionId }
```

### 版本聊天

每个历史版本都可以独立对话，类似分支预览：

| 场景 | 路由 | 版本 | 权限 | 会话 source |
|------|------|------|------|------------|
| 正式聊天 | `/{org}/{agent}/chat` | publishedVersionId | viewer+ | `"chat"` |
| 草稿预览 | `/{org}/{agent}/preview` | editingVersionId | editor+ | `"preview"` |
| 版本聊天 | `/{org}/{agent}/v/{ref}/chat` | 指定 versionId | viewer+ | `"version:{versionId}"` |

- URL 中的 `{ref}` 支持版本号（如 `1.0.0`）和 UUID
- 版本解析 API：`GET /api/agents/{agentId}/versions/by-ref?ref=1.0.0`
- 不同 source 的会话完全隔离
- Build 页面 VersionsSidebar 每个版本的下拉菜单包含"对话"入口，点击在新窗口打开版本聊天

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

## 版本 Diff 对比

版本详情 Sheet 中提供 "Compare" 按钮，支持选择两个版本对比差异。

### 使用方式
1. 在 Build 页面版本侧栏点击版本三点菜单 → "Detail"
2. 在详情 Sheet 底部点击 "Compare"
3. 从下拉选择器中选择另一个版本（支持 "Current (editing)" 选项）
4. 查看两层 diff 视图：概览层（+N ~N -N）→ 展开层（字段级变化）

### 技术实现
- **API**：`GET /api/agents/[id]/versions/diff?from=<versionId>&to=<versionId>` — 并行构建两个快照，计算 diff 返回 `{ diff, summary }`
- **Diff 引擎**：`src/lib/versions/diff.ts` — 纯函数 `computeSnapshotDiff(from, to)` 比较两个 `AgentSnapshot`，覆盖全部 16 种资源类型
  - 数组资源（tools, functions 等）：通过 `key` 字段匹配，分类为 added/removed/modified
  - 单例资源（chatConfig, memoryConfig）：逐字段比较，状态为 added/removed/modified/unchanged
  - `testCases` 字段在比较时被跳过（噪声太多）
- **UI 组件**：`src/components/versions/version-diff-sheet.tsx` — 三层折叠视图
  - 概览层：按资源类型分组，显示 `+N ~N -N` 计数
  - 资源层：展开后显示具体新增/删除/修改的资源列表
  - 字段层：展开修改的资源，显示 `field: "old" → "new"` 变化

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/db/schema.ts` | 数据库 schema（所有 versionId 列定义） |
| `src/lib/versions/copy-resources.ts` | 版本复制引擎 |
| `src/lib/versions/resolve.ts` | versionId 解析工具（含 validateVersionBelongsToAgent、resolveVersionByRef） |
| `src/lib/versions/mode.ts` | VersionMode 类型定义（hooks 和 ChatPageContent 使用） |
| `src/lib/versions/snapshot.ts` | 快照构建/恢复（用于导出/导入） |
| `src/lib/versions/diff.ts` | 版本 diff 引擎（`computeSnapshotDiff` + `buildDiffSummary`） |
| `src/lib/pool/queries.ts` | Pool 资源查询（按 versionId 过滤） |
| `src/components/chat-page-content.tsx` | 聊天页面共享组件（chat/preview/版本聊天共用） |
| `src/components/versions/version-diff-sheet.tsx` | 版本 diff UI 组件 |
| `src/app/api/agents/[id]/versions/diff/route.ts` | 版本 diff API |
| `src/app/api/agents/[id]/versions/by-ref/route.ts` | 版本 ref 解析 API |
