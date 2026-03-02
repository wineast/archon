# 修复报告：Wiki 查询加 versionId 过滤修复跨 Agent 数据泄露

> 修复时间：2026-03-01 15:07
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-cross-agent-wiki-data-leak-no-agentid-filter-20260301`

## 1. Root Cause（根因）

### 为什么坏了
`createToolContext()` 已接收 `versionId` 参数，且 `dataset.get()` 和 `fn()` 的查询已正确使用 `versionId` 过滤，但 Wiki 的三个查询方法是后续新增的，遗漏了 `versionId` 过滤条件。

### 因果链
1. `wiki.search(query)` / `wiki.findByPrefix(prefix)` 的 SQL WHERE 子句仅包含内容/前缀匹配条件，无 `versionId` 限制
2. → 查询命中全库 `wiki_documents` 表所有行，包括其他 Agent、其他组织的文档
3. → Tool Handler 可获取到不属于当前 Agent 版本的 Wiki 数据，构成跨 Agent 数据泄露

## 2. Change（变更）

### 修改摘要
在 `wiki.get()`、`wiki.findByPrefix()`、`wiki.search()` 三个方法中统一加入 `eq(wikiDocuments.versionId, versionId)` 过滤条件；当 `versionId` 未提供时提前返回空结果。

### 修改明细
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/lib/tools/tool-context.ts:166` | 新增 `if (!versionId) return null;` guard | 无 versionId 时 get 直接返回 null |
| `web/src/lib/tools/tool-context.ts:178` | `.where(eq(id))` → `.where(and(eq(id), eq(versionId)))` | UUID 查询加版本隔离 |
| `web/src/lib/tools/tool-context.ts:183` | 去掉 `&& agentId` 条件 | versionId guard 已覆盖，fallback 始终可执行 |
| `web/src/lib/tools/tool-context.ts:193` | `eq(agentId)` → `eq(versionId)` | key fallback 改用更精确的 versionId 过滤 |
| `web/src/lib/tools/tool-context.ts:211` | 新增 `if (!versionId) return [];` guard | 无 versionId 时 findByPrefix 返回空数组 |
| `web/src/lib/tools/tool-context.ts:219` | `.where(like(key))` → `.where(and(eq(versionId), like(key)))` | findByPrefix 加版本隔离 |
| `web/src/lib/tools/tool-context.ts:227` | 新增 `if (!versionId) return [];` guard | 无 versionId 时 search 返回空数组 |
| `web/src/lib/tools/tool-context.ts:235` | `.where(ilike(content))` → `.where(and(eq(versionId), ilike(content)))` | search 加版本隔离 |

## 3. Rationale（决策依据）

### 为什么选择此方案
- **用 `versionId` 而非 `agentId` 过滤**：`versionId` 是比 `agentId` 更精确的隔离粒度，且与项目约定一致（CLAUDE.md：「查询版本化资源时必须加 `versionId` 过滤」）。`versionId` 天然隶属于某个 Agent，加了 `versionId` 就不需要再加 `agentId`
- **无 versionId 时返回空而非报错**：与同文件中 `getResolved()`（返回 `{}`）和 `getCompiledFunctions()`（返回空 Map）的行为模式一致

### 考虑过的替代方案
| 方案 | 未采用原因 |
|------|-----------|
| 只加 `agentId` 过滤 | 粒度不够，同一 Agent 的不同版本之间仍会混入数据 |
| 同时加 `agentId` + `versionId` | `versionId` 已隐含 `agentId` 信息（通过外键关系），加两个条件冗余 |

### 已知局限
无

## 4. Blast Radius（影响范围）

### 直接影响
- `createToolContext()` 返回的 `wiki` 对象的三个方法——仅在 Tool Handler 运行时调用

### 间接影响
无——修改仅收窄查询范围，不影响返回数据格式

### 不影响
- Wiki 的 API 路由（`/api/wiki`）——使用独立的 `getAgentResources()` 查询，已有正确过滤
- Build Chat 的 Wiki 工具（`wiki-tools.ts`）——使用独立查询逻辑，不经过 `createToolContext`
- 同文件中的 `dataset`、`fn`、`ontology` 上下文——不受影响

## 5. Verification（验证方式）

### 静态检查
- `make typecheck`：通过（112 个源文件无类型错误）
- `make test`：通过（112 test files, 1275 tests passed）

### 正向验证
代码审查验证——三个查询方法修复后的 SQL 等价于：
- `wiki.get(uuid)`: `WHERE id = ? AND version_id = ?` — 仅匹配当前版本的文档
- `wiki.get(key)`: `WHERE version_id = ? AND key = ?` — 仅匹配当前版本的文档
- `wiki.findByPrefix(prefix)`: `WHERE version_id = ? AND key LIKE ?` — 仅匹配当前版本的文档
- `wiki.search(query)`: `WHERE version_id = ? AND content ILIKE ?` — 仅匹配当前版本的文档

### 回归验证
- `make typecheck` 通过：无类型破坏
- `make test` 1275 tests 全部通过：无行为回归

## 过程备注

[确认] `wiki.get()` 的 key fallback 路径原来有 `&& agentId` 条件守护，改为 versionId 过滤后该守护已被顶部的 `if (!versionId) return null` 覆盖，可安全移除
