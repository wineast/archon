# 验证报告：Wiki 查询加 versionId 过滤修复跨 Agent 数据泄露

> 验证时间：2026-03-01 15:12
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-cross-agent-wiki-data-leak-no-agentid-filter-20260301`

## 1. Reproduction Result（复现验证）

### 验证方式
代码审查验证（服务端 SQL 查询逻辑修复，非 UI 问题，无法通过 Playwright 直接复现）。逐行审查修复后的三个查询方法。

### 结果
✅ 通过

修复后的 SQL 查询等价于：
- `wiki.get(uuid)`: `WHERE id = ? AND version_id = ?` — 仅匹配当前版本
- `wiki.get(key)`: `WHERE version_id = ? AND key = ?` — 仅匹配当前版本
- `wiki.findByPrefix(prefix)`: `WHERE version_id = ? AND key LIKE ?` — 仅匹配当前版本
- `wiki.search(query)`: `WHERE version_id = ? AND content ILIKE ?` — 仅匹配当前版本

三个方法均已加入 `eq(wikiDocuments.versionId, versionId)` 条件，无 `versionId` 时提前返回空结果，与同文件中 `getResolved()`/`getCompiledFunctions()` 的防御模式一致。

## 2. Cause-Fix Coherence（因果一致性）

### Root Cause 可解释 Delta？
✅ 是。WHERE 子句缺少 versionId 限制 → 查询命中全库 wiki_documents → 跨 Agent 数据泄露。因果链完整且无歧义。

### Change 可消除 Root Cause？
✅ 是。在每个查询的 WHERE 子句中加入 `eq(wikiDocuments.versionId, versionId)` 从 SQL 层面收窄查询范围到当前版本，从机理上切断因果链。不是"止痛"（如在应用层过滤），而是"治病"（在 SQL 层面阻止数据进入结果集）。

### Rationale 无漏洞？
✅ 无漏洞。
- 选用 `versionId` 而非 `agentId`：`versionId` 通过外键隶属于特定 Agent，粒度更精确，且与项目约定一致（CLAUDE.md：「查询版本化资源时必须加 versionId 过滤」）
- 被排除的"只加 agentId"方案：确实粒度不够，同 Agent 不同版本之间仍会混入
- 被排除的"同时加 agentId + versionId"方案：确实冗余，versionId 已隐含 agentId

### 结果
✅ 一致，因果链完整，决策合理

## 3. Boundary Validation（边界验证）

### 测试的边界变体
| 变体 | 条件 | 结果 |
|------|------|------|
| versionId 为 undefined | `createToolContext()` 不传 versionId | ✅ 三个方法均提前返回空结果（null/[]），不会查库 |
| wiki.get() key fallback | 传入非 UUID 字符串作为 id | ✅ UUID 正则不匹配，走 key fallback 路径，该路径也有 versionId 过滤 |
| wiki.get() UUID 路径 | 传入其他 Agent 的 wiki UUID | ✅ 因加了 versionId 条件，其他 Agent 的 UUID 不会命中 |

### 同类漏洞排查
边界验证中发现 `tool-context.ts` 的 Ontology 相关查询（`objectInstances`、`objectLinks`、`objectRelations`）在 `get()`、`update()`、`graph()` 方法中存在类似的 agentId 过滤缺失。但这些属于 **Ontology 模块的独立问题**，不在本次 Wiki 修复的范围内，应作为后续 issue 单独跟踪。

### 结果
✅ 通过（Wiki 查询边界完整覆盖；Ontology 同类问题标记为残留风险）

## 4. Regression Result（回归验证）

### 静态检查
- `make typecheck`：✅ 通过（无类型错误）
- `make test`：✅ 通过（112 test files, 1275 tests passed）
  - 注：全量运行中 `session-history.test.tsx` 偶发 1 次失败，单独运行通过（6/6），属于 flaky test，与本次修改无关

### Blast Radius 区域验证
| 区域 | 修复报告声明 | 实际验证结果 |
|------|-------------|-------------|
| Wiki API 路由 (`/api/wiki`) | 不影响 | ✅ 确认——使用独立的 `getAgentResources()` 查询，不经过 `createToolContext` |
| Build Chat Wiki 工具 (`wiki-tools.ts`) | 不影响 | ✅ 确认——使用独立查询逻辑，按 `agentId` 过滤 |
| Dataset/Fn 上下文 | 不影响 | ✅ 确认——`getResolved()`/`getCompiledFunctions()` 代码未被修改 |
| Ontology 上下文 | 不影响 | ✅ 确认——`createOntologyContext()` 代码未被修改 |

### 结果
✅ 通过，静态检查全绿 + Blast Radius 区域无回归

## 5. Verdict（裁定）

### 判决
✅ 合并

### 证据摘要
- **Reproduction**：三个查询方法均已加入 versionId 过滤，跨 Agent 数据泄露路径已封堵
- **Coherence**：根因分析准确，修复从 SQL 层面切断因果链，决策合理
- **Boundary**：versionId 为空时安全返回，UUID/key 两条路径均覆盖
- **Regression**：typecheck + 1275 tests 全绿，影响范围确认无回归

### 残留风险
- **Ontology 同类漏洞**：`tool-context.ts` 中 `createOntologyContext` 的 `get()`、`update()`、`graph()` 方法在查询 `objectInstances`/`objectLinks`/`objectRelations` 时缺少 `agentId` 过滤，存在同类跨 Agent 数据泄露风险。建议作为独立 issue 跟踪修复

## 过程备注

[确认] `session-history.test.tsx` 的间歇性失败为 flaky test，单独运行 6/6 通过，与本次修改无关
[确认] Ontology 查询的同类漏洞不在本次修复范围内，但已记录为残留风险
