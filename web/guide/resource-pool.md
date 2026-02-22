# 资源共享池

## 概念

资源共享池是全局资源管理机制。资源不再只能归属于某个 agent，还可以作为"池资源"存在于全局共享池中，供任意 agent 按需引用。

### 7 种资源类型

| resourceType | 对应表 | 说明 |
|---|---|---|
| `tool` | `tools` | 工具定义 |
| `component` | `components` | 可复用 UI 组件 |
| `function` | `functions` | 服务端函数 |
| `dataset` | `datasets` | JSON 数据集 |
| `wiki` | `wikiDocuments` | Wiki 文档 |
| `schema` | `schemas` | 参数 Schema |
| `mcp-server` | `mcpServers` | MCP 服务器 |

类型常量定义在 `web/src/db/schema.ts` 的 `RESOURCE_TYPES`。

### 资源形态

- **池资源**：`agentId = NULL`，存在于全局池中，任何 agent 可通过引用使用
- **私有资源**：`agentId = X`，归属特定 agent，仅该 agent 可用

### origin 字段

所有 7 种资源表都有 `origin` 字段，标识资源来源：

| origin | 含义 | 可编辑 | 示例 |
|---|---|---|---|
| `builtin` | 平台内置 | 否 | build-chat 系统工具 |
| `user` | 用户创建 | 是 | 用户自定义工具 |
| `marketplace` | 市场安装 | 否（发布者维护） | 未来市场工具 |

类型常量定义在 `RESOURCE_ORIGINS`。

---

## 数据模型

### 资源表变更

7 种资源表统一做了以下改造：

1. `agentId` 改为 **nullable**（`NULL` 表示池资源）
2. 外键删除策略改为 `onDelete: "set null"`（池资源不跟 agent 删除）
3. 新增 `origin` 字段：`text("origin").notNull().default("user").$type<ResourceOrigin>()`
4. 新增池内唯一索引：`uniqueIndex("xxx_pool_key_idx").on(table.key).where(sql\`agent_id IS NULL AND deleted_at IS NULL\`)`（partial unique index，软删除记录不参与唯一性检查）

不受影响的表（保持 agent 私有）：`chatConfigs`、`modelConfigs`、`evalCases`、`judgeConfigs`、`chatSessions`、`memories`、`skills`、`embedTokens` 等。

### agentResourceRefs 表

Agent 引用池资源的关联表（`web/src/db/schema.ts`）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID PK | 主键 |
| `agentId` | UUID FK → agents | 引用方 agent |
| `resourceType` | TEXT | 资源类型枚举（`tool`/`component`/`function`/`dataset`/`wiki`/`schema`/`mcp-server`） |
| `resourceId` | UUID | 被引用的池资源 ID |
| `enabled` | BOOLEAN | 是否启用，默认 `true` |
| `createdAt` | TIMESTAMP | 引用创建时间 |

唯一约束：`(agentId, resourceType, resourceId)` —— 同一 agent 不能重复引用同一池资源。

索引：`agent_resource_refs_resource_idx` on `(resourceId)` —— 加速"查看哪些 agent 引用了此资源"。

---

## API

### 池资源 CRUD

路由为通用的 `[resourceType]` 参数化路由，7 种类型共用一套。

#### `GET /api/pool/[resourceType]`

列出池中该类型的所有资源（`agentId IS NULL`，排除软删除）。按 `key` 升序排列。

- 权限：登录用户即可（`requireAuth`）
- 返回：资源数组

#### `POST /api/pool/[resourceType]`

创建池资源。请求体为资源字段，`agentId` 会被强制设为 `null`。

- 权限：`requireSuperAdmin`
- 返回：创建的资源，状态码 `201`

#### `PATCH /api/pool/[resourceType]/[id]`

编辑池资源。校验资源存在且 `agentId IS NULL`。请求体中的 `agentId` 和 `id` 会被忽略。

- 权限：`requireSuperAdmin`
- 返回：更新后的资源

#### `DELETE /api/pool/[resourceType]/[id]`

删除池资源。删除前检查 `agentResourceRefs` 中是否有引用：
- 有引用 → 返回 `409 Conflict`，附带 `refCount` 和 `agentIds`
- 无引用 → 软删除（设置 `deletedAt`）

- 权限：`requireSuperAdmin`
- 返回：`{ ok: true }` 或 `409`

**表映射**：`RESOURCE_TABLE_MAP`（`web/src/lib/pool/constants.ts`）将 `ResourceType` 映射到对应的 Drizzle 表对象。

### Agent 引用管理

#### `GET /api/agents/[id]/refs`

列出某 agent 的所有池资源引用。

- 权限：`requireAgentRole(agentId, "viewer")`
- 返回：`agentResourceRefs` 行数组

#### `POST /api/agents/[id]/refs`

添加一条池资源引用。请求体：`{ resourceType, resourceId }`。

会校验目标资源存在且为池资源（`agentId IS NULL`）。使用 `onConflictDoNothing` 保证幂等。

- 权限：`requireAgentRole(agentId, "editor")`
- 返回：创建的引用行，状态码 `201`；已存在则返回现有行

#### `PATCH /api/agents/[id]/refs/[refId]`

切换引用的启用状态。请求体：`{ enabled: boolean }`。

- 权限：`requireAgentRole(agentId, "editor")`
- 返回：更新后的引用行

#### `DELETE /api/agents/[id]/refs/[refId]`

移除一条引用。

- 权限：`requireAgentRole(agentId, "editor")`
- 返回：`{ ok: true }`

---

## 运行时查询

查询函数位于 `web/src/lib/pool/queries.ts`。

### 核心模式

Agent 运行时可用的资源 = **私有资源**（`agentId = X`） + **池引用**（通过 `agentResourceRefs` 关联的 `agentId IS NULL` 资源）。

### 通用函数

#### `getAgentResources<T>(agentId, resourceType)`

返回 `WithPoolMeta<T>[]`，每条记录附带元数据：

```ts
type WithPoolMeta<T> = T & {
  _source: "private" | "pool";
  _refId?: string;      // pool 资源的引用 ID
  _refEnabled?: boolean; // pool 资源的引用启用状态
};
```

### 专用函数

| 函数 | 用途 |
|---|---|
| `getAgentTools(agentId)` | 获取所有工具（私有 + 池），带 `_source` 元数据 |
| `getAgentEnabledTools(agentId)` | 运行时：仅返回启用的工具（私有 `enabled=true` + 池引用 `refEnabled=true AND enabled=true`） |
| `getAgentEnabledMcpServers(agentId)` | 运行时：仅返回启用的 MCP 服务器 |
| `getAgentDatasets(agentId)` | 获取所有数据集（轻量字段：key/name/data） |
| `getAgentWikiDocs(agentId)` | 获取所有 Wiki 文档 |
| `getAgentSchemas(agentId)` | 获取所有 Schema |

---

## Builtin 池资源

### 架构概览

Builtin 池资源的管理分为三层：

| 层 | 位置 | 职责 |
|---|---|---|
| **数据定义** | `web/src/db/builtins/` | 静态数据（JSON）+ 代码提取（tools） |
| **入库 Seeder** | `web/src/db/seeders/seed-builtin-pool.ts` | 从 builtins 加载定义 → upsert 到数据库 |
| **Ref 创建** | `web/src/lib/pool/builtin-refs.ts` | 为 agent 创建池资源引用 |

### 数据定义（`web/src/db/builtins/`）

所有 builtin 资源的静态定义集中在此目录：

| 文件 | 格式 | 加载函数 |
|---|---|---|
| `functions.json` | JSON 数组 | `loadBuiltinFunctionDefs()` |
| `components.json` | JSON 数组 | `loadBuiltinComponentDefs()` |
| `wiki.json` | JSON 清单（key→file 映射） | `loadBuiltinWikiManifest()` |
| `tools.ts` | 代码提取 | `loadBuiltinToolDefs()` |
| `types.ts` | 共享类型定义 | — |
| `index.ts` | 统一导出 | — |

每种资源类型一个 JSON 文件，所有元素必须有 `key` + `name` 字段。

**工具的特殊处理**：工具通过 `loadBuiltinToolDefs()` 从 Vercel AI SDK 的 `tool()` 定义中提取元数据（key、description、parametersSchema），这是代码绑定的，不能变成静态 JSON。

**Wiki 内容加载**：`wiki.json` 只存 `{ key, name, file }` 映射，实际内容在 seeder 阶段从 `guide/{file}` 读取。`GUIDE_DIR` 常量指向 guide 目录的绝对路径。

### Seed Pipeline

```
seedModels → seedBuiltinPool → seedUsers
```

`seedBuiltinPool`（`web/src/db/seeders/seed-builtin-pool.ts`）从 `@/db/builtins` 导入 4 个 loader，内部包含 4 个 upsert 函数，依次入库：

1. 工具 — `onConflictDoUpdate` 更新 description + parametersSchema
2. 函数 — `onConflictDoNothing`，同时插入 `functionTestCases`
3. 组件 — `onConflictDoNothing`
4. Wiki — `onConflictDoUpdate` 更新 name + content

### 设计原则

- **池资源 seed** 在 pipeline 中集中完成，早于用户/org 创建
- **`ensureOrgDefaults()`** 只做 org 级别的事：创建 agent、refs、configs，不负责池资源创建
- **Ref 函数**（`web/src/lib/pool/builtin-refs.ts`）只查询 + 创建引用，不触碰池资源本身

### Ref 创建

代码位于 `web/src/lib/pool/builtin-refs.ts`，提供两个函数：

#### `ensureBuiltinToolRefs(db, buildChatAgentId, versionId)`

为 builder slot agent 创建对所有 builtin 池工具的引用。在 `ensureOrgDefaults()` 中调用。

#### `ensureBuiltinWikiRefs(db, agentId, versionId)`

为 assist slot agent 创建对所有 builtin 池 wiki 的引用。在 `ensureOrgDefaults()` 中调用。

---

## Builtin 函数运行时

### 运行时依赖注入

Builtin 函数不仅是池资源本身，还关联着运行时依赖（如 filtrex 的 `compileExpression`）。依赖通过 `BASE_DEPS` 注入为 `globalThis` 全局变量，函数代码直接使用，无需 import。

依赖注入遵循 **引用即可用** 原则：

1. `tool-context.ts` 中 `getCompiledFunctions()` 调用 `getReferencedBuiltinFunctionKeys(agentId)` 查询 Agent 引用的 builtin 函数
2. `buildBaseDeps(referencedKeys)` 根据引用的 key 构建过滤后的依赖 map
3. 依赖注入为 `globalThis` 全局变量，函数代码可直接使用

Agent 必须从共享池添加 builtin 函数引用，运行时才会注入对应依赖。

> 注意：函数的 ref 不使用 `enabled` 字段（该字段为 tool 等资源预留），ref 存在即表示可用。

### 当前 Builtin 函数列表

| Key | 名称 | 说明 |
|-----|------|------|
| `compileExpression` | Compile Expression | 将字符串表达式编译为可执行函数（数学公式、条件逻辑等），底层使用 filtrex |

---

## Builtin Wiki 与 AI 辅助编辑

### 概念

`web/guide/` 下的所有使用指南文档作为 builtin wiki 池资源存入数据库，供 assist agent 通过 LiquidJS `{% include 'key' %}` 引用。

清单文件 `web/src/db/builtins/wiki.json` 的格式为 `[{ key, file, name }]`，key 用于 LiquidJS `{% include 'key' %}` 引用。

### AI 辅助编辑集成

assist agent 的系统提示词是一个 LiquidJS 模板，通过 `{% if fieldContext == "xxx" %}{% include 'yyy' %}{% endif %}` 条件引用不同的 guide wiki。`fieldContext` 作为 `extraVars` 在模板渲染时注入，由各 assist 路由传入。

| 路由 | fieldContext | entity |
|------|-------------|--------|
| prompt-assist | `system-prompt` | `prompt` |
| tool-code-assist | `tool-handler` | `code` |
| jsx-assist | `component-jsx` | `jsx` |
| function-code-assist | `function-code` | `code` |
| wiki-assist | `wiki-content` | `content` |
| dataset-assist | `dataset-data` | `data` |
| schema-code-assist | `schema` | `schema` |

---

## UI

### Admin 池管理区

超级管理员在 Admin 面板中管理全局池资源。支持对 7 种资源类型的 CRUD 操作。删除时如果资源仍被 agent 引用，会返回 409 错误并显示引用详情。

### Agent Build "从池中添加"

Agent Build 页面中，每种资源 Tab 提供"从共享池添加"入口：

1. 弹出 Dialog 展示池中该类型的所有资源
2. 已引用的资源标记为"已添加"
3. 点击"添加"创建 `agentResourceRef`
4. 添加后的池资源出现在该 agent 的资源列表中，带有 `_source: "pool"` 标识

### 池引用详情视图（只读模式）

Agent Build 页面中，点击池引用资源（`_source === "pool"`）时，详情视图切换为**只读模式**：

#### 规则

1. **表单只读**：所有字段 `disabled`/`readOnly`，不可编辑
2. **隐藏 Save/Delete**：底部操作栏替换为 `PoolRefBottomBar`
3. **来源 Badge**：顶部显示 `PoolRefBadge`（`系统内置` / `共享池`）
4. **Builtin 额外隐藏**：`origin === "builtin"` 的资源隐藏不适用的编辑区域：
   - Tool：隐藏 Handler 编辑器 + 执行环境选择器
   - Function：隐藏 Code 编辑器
   - Component：隐藏 JSX/CSS 编辑器
5. **引用层控制**：
   - "移除引用"按钮（带确认弹窗）
   - Enabled 开关仅 `resourceType === "tool"` 时显示

#### 关键组件

| 组件 | 路径 | 用途 |
|---|---|---|
| `PoolRefBadge` | `web/src/components/pool/pool-ref-badge.tsx` | 显示来源标签 |
| `PoolRefBottomBar` | `web/src/components/pool/pool-ref-bottom-bar.tsx` | 替代底部操作栏 |
| `PoolMeta` | `web/src/components/pool/types.ts` | 池引用元数据类型 |
| `toPoolMeta()` | `web/src/components/pool/types.ts` | 从 `WithPoolMeta` 提取 `PoolMeta` |

#### 数据流

1. Panel 组件中列表数据为 `WithPoolMeta<T>[]`，包含 `_source`/`_refId`/`_refEnabled`
2. Panel 调用 `toPoolMeta(activeItem)` 提取 `PoolMeta`（私有资源返回 `undefined`）
3. Detail 组件接收 `poolMeta?: PoolMeta`，存在时启用只读模式
4. Form 组件接收 `readOnly` + `hideBuiltinSections` props

---

## 版本快照兼容

Agent 版本快照（`buildSnapshot` / `restoreSnapshot`）支持池资源引用的序列化与恢复。

### 快照格式

`AgentSnapshot` 包含 `resourceRefs` 字段，每条引用序列化为：

```ts
interface ResourceRefSnapshotItem {
  resourceType: ResourceType; // "tool" | "component" | ...
  resourceKey: string;        // 池资源的 key（人类可读，保持可移植性）
  enabled: boolean;           // 引用启用状态
}
```

### Build（构建快照）

`buildSnapshot()` 查询 `agentResourceRefs` 表获取 agent 的所有池资源引用，通过 `RESOURCE_TABLE_MAP` 批量查找对应资源表将 `resourceId` 解析为 `resourceKey`。

### Restore（恢复快照）

`restoreSnapshot()` 处理流程：
1. **删除阶段**：与其他资源并行删除 `agentResourceRefs` 中该 agent 的所有引用
2. **重建阶段**（步骤 14，在所有私有资源恢复完毕后）：对每条 `ResourceRefSnapshotItem`，通过 `(key, agentId IS NULL)` 查找池资源，找到则插入引用，找不到则跳过

---

## 权限

| 操作 | 所需权限 |
|---|---|
| 查看池资源列表 | 登录用户（`requireAuth`） |
| 创建/编辑/删除池资源 | `requireSuperAdmin` |
| 查看 agent 的引用列表 | `requireAgentRole(agentId, "viewer")` |
| 添加/移除/切换引用 | `requireAgentRole(agentId, "editor")` |
