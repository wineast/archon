# 缺陷报告：Wiki 查询缺少 versionId 过滤导致跨 Agent 数据泄露

> 诊断时间：2026-03-01 15:04
> 环境：dev | 服务端 | 分支 `dev-cross-agent-wiki-data-leak-no-agentid-filter-20260301`

## 1. Delta（偏差）

### 期望行为（Should Be）
Tool Handler 中通过 `context.wiki.get(id)`、`context.wiki.search(query)`、`context.wiki.findByPrefix(prefix)` 查询 Wiki 文档时，只能获取当前 Agent 当前版本的 Wiki 文档，不能跨 Agent、跨版本访问。

### 实际行为（Is）
- `wiki.get(uuid)`：按 UUID 查询时无任何 agentId/versionId 过滤，**任何 Agent 可通过 UUID 读取全库任意 Wiki 文档**
- `wiki.findByPrefix(prefix)`：按 key 前缀查询时无任何过滤，**返回全库所有匹配的 Wiki 文档**
- `wiki.search(query)`：按内容搜索时无任何过滤，**返回全库所有匹配的 Wiki 文档**

### 偏差描述
`tool-context.ts` 中三个 Wiki 查询方法缺少 `versionId` 过滤条件，违反版本化资源隔离约定，导致跨 Agent 数据泄露——攻击者可在 Tool Handler 中调用 `context.wiki.search("")` 获取全库 Wiki 文档。

## 2. Reproduction Path（复现路径）

### 环境与前置条件
- 至少两个 Agent（Agent A 和 Agent B），各自有 Wiki 文档
- Agent A 有一个自定义 Tool，Handler 中调用 `context.wiki.search("")`

### 操作步骤（代码级复现）
1. Agent A 的 Tool Handler 执行 `context.wiki.search("")`
2. 查询等价于 `SELECT id, name, content FROM wiki_documents WHERE content ILIKE '%%'`
3. → 返回**全库**所有 Wiki 文档，包括 Agent B、Agent C 等其他 Agent 的文档

### 复现证据（代码分析）

**`wiki.search()` — 无任何过滤（第 224-232 行）：**
```typescript
async search(query: string) {
  const rows = await db
    .select({ id: wikiDocuments.id, name: wikiDocuments.name, content: wikiDocuments.content })
    .from(wikiDocuments)
    .where(ilike(wikiDocuments.content, `%${query}%`));
  // ❌ 缺少 eq(wikiDocuments.versionId, versionId) 条件
}
```

**`wiki.findByPrefix()` — 无任何过滤（第 209-217 行）：**
```typescript
async findByPrefix(prefix: string) {
  const rows = await db
    .select({ id: wikiDocuments.id, name: wikiDocuments.name, content: wikiDocuments.content })
    .from(wikiDocuments)
    .where(like(wikiDocuments.key, `${prefix}%`));
  // ❌ 缺少 eq(wikiDocuments.versionId, versionId) 条件
}
```

**`wiki.get(uuid)` — UUID 路径无过滤（第 165-180 行）：**
```typescript
if (isUuid) {
  row = await db
    .select({ id: wikiDocuments.id, content: wikiDocuments.content, agentId: wikiDocuments.agentId })
    .from(wikiDocuments)
    .where(eq(wikiDocuments.id, id))  // ❌ 仅按 UUID 查询，无 versionId 过滤
    .limit(1)
    .then((rows) => rows[0]);
}
```

**对比正确实现（API 路由 `web/src/app/api/wiki/route.ts`）：**
```typescript
const versionId = await resolveEditingVersionId(agentId);
const rows = await getAgentResources<WikiDocumentRow>(agentId, "wiki", versionId);
// ✅ 通过 versionId 隔离
```

## 3. Location（定位）

### 功能模块
Tool Handler 运行时 → Wiki 查询上下文（`context.wiki`）

### 代码定位
- `web/src/lib/tools/tool-context.ts:165-179` — `wiki.get()` UUID 查询路径缺少 versionId 过滤
- `web/src/lib/tools/tool-context.ts:209-217` — `wiki.findByPrefix()` 缺少 versionId 过滤
- `web/src/lib/tools/tool-context.ts:224-232` — `wiki.search()` 缺少 versionId 过滤

### 根因分析

`createToolContext(agentId, versionId)` 函数接收了 `versionId` 参数，其他资源（dataset、fn）的查询已正确使用 `versionId` 过滤（见 `getResolved()` 和 `getCompiledFunctions()`），但 Wiki 的三个查询方法是后续新增的，遗漏了 `versionId` 过滤条件。

`wikiDocuments` 表设计中 `versionId` 是版本隔离的标准字段（有 `uniqueIndex("wiki_documents_version_id_key_idx").on(versionId, key)` 约束），查询时必须加 `eq(wikiDocuments.versionId, versionId)` 才能保证数据隔离。

## 4. Impact（影响）

### 严重度
**阻断** — 安全漏洞，数据隔离失效

### 影响范围
所有使用 Wiki 功能的 Agent，prod 和 dev 环境均受影响

### 影响描述
- **数据泄露**：任何 Agent 的 Tool Handler 可以读取其他 Agent（甚至其他组织）的 Wiki 文档内容
- **攻击向量**：恶意 Tool Handler 调用 `context.wiki.search("")` 获取全库数据，结合 `fetch()` 外泄
- **合规风险**：多租户场景下跨组织数据泄露属于严重安全事件

## 修复方向

三个 Wiki 查询方法统一加上 `versionId` 过滤条件：

- **最小改动**：在 `wiki.get()`、`wiki.findByPrefix()`、`wiki.search()` 三个方法中，每个查询的 `.where()` 条件增加 `eq(wikiDocuments.versionId, versionId)`。当 `versionId` 未提供时返回空结果
- **`wiki.get()` UUID 路径**：同时加 `versionId` 过滤，防止通过已知 UUID 跨 Agent 读取
- **`wiki.get()` key fallback 路径**：已有 `agentId` 过滤，需改为 `versionId` 过滤（更精确）
- **风险**：改动范围小，仅影响 SQL 查询条件，不影响返回格式
- **验收标准**：Given 两个不同 Agent 各有 Wiki 文档, When Agent A 的 Tool Handler 调用 `context.wiki.search("")`, Then 只返回 Agent A 当前版本的 Wiki 文档

## 过程备注

[确认] wiki.get() 的 key fallback 路径（第 182-198 行）已有 `agentId` 过滤，但未用更精确的 `versionId` 过滤——应一并修复
[确认] 同一文件中 dataset 和 fn 的查询已正确使用 versionId 过滤（通过 `getAgentDatasets`/`getAgentFunctions` 函数），wiki 是唯一遗漏
