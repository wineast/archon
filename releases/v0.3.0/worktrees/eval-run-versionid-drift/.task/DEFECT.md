# 缺陷报告：Eval Run 执行时 versionId 实时解析导致配置漂移

> 诊断时间：2026-03-02 12:00
> 环境：dev | 分支 `dev-eval-run-versionid-drift-20260302`

## 1. Delta（偏差）

### 期望行为（Should Be）
Eval Run 创建时快照完整的执行上下文（modelConfig + versionId），所有 case 执行时使用同一个 versionId 加载 tools、templateData（datasets/wiki/functions/schemas），确保与已快照的 systemPrompt 一致。

### 实际行为（Is）
Run 创建时只快照了 modelConfig（systemPrompt/temperature/modelId），未快照 versionId。每个 case 执行时通过 `resolveEditingVersionId(agentId)` 实时查询当前编辑版本，如果用户在 eval 运行期间发布新版本或切换编辑版本，后续 case 会使用新版本的 tools 和 templateData + 旧版本的 systemPrompt。

### 偏差描述
Run 内不同 case 可能使用不同版本的资源执行，systemPrompt 中引用的工具名或 Liquid 变量可能与实际提供的 tools/templateData 不匹配，导致评估结果不可靠。

## 2. Reproduction Path（复现路径）

### 环境与前置条件
- 一个已配置好 Model Config 和 Eval Cases 的 Agent
- Agent 有至少一个已启用的 Tool（systemPrompt 中引用了该工具名）

### 操作步骤
1. 打开 Eval 页面，发起一次 Eval Run（此时 editingVersionId = V1）
2. 在 Eval Run 执行期间（case 尚未全部完成），切换到 Build 页面修改 Tool 配置或发布新版本（editingVersionId 变为 V2）
3. 后续尚未执行的 case 会使用 V2 的 tools/templateData，但 systemPrompt 仍是 V1 的快照

### 复现证据

此缺陷为竞态条件，通过代码调用链分析确认，无需 UI 截图复现。关键代码路径如下：

**Run 创建时（route.ts:57）** — 解析 versionId 但不存储：
```typescript
// web/src/app/api/eval/run/route.ts:57
const versionId = await resolveEditingVersionId(agentId);
// versionId 仅用于读取 modelConfig，未写入 run 记录
```

**Run 记录插入（route.ts:116-146）** — 无 versionId 字段：
```typescript
// web/src/app/api/eval/run/route.ts:116-146
const [run] = await db.insert(evalRuns).values({
  agentId,
  chatModel: modelConfig.modelId,          // ✅ 快照
  chatSystemPrompt: modelConfig.systemPrompt, // ✅ 快照
  chatTemperature: modelConfig.temperature,   // ✅ 快照
  // ❌ 缺少 versionId 快照
  ...
}).returning();
```

**Case 执行时（execute-case.ts:135-137）** — 实时解析 versionId：
```typescript
// web/src/lib/eval/execute-case.ts:135-137
const evalAgentId = run.agentId ?? undefined;
const evalVersionId = evalAgentId ? await resolveEditingVersionId(evalAgentId) : undefined;  // ❌ 实时查询
const templateData = await gatherTemplateData(evalAgentId, evalVersionId);  // 用实时 versionId 加载资源
```

**Tools 查询（execute-case.ts:155-159）** — 同样用实时 versionId：
```typescript
// web/src/lib/eval/execute-case.ts:155-159
const enabledRows = evalVersionId
  ? await db.select().from(tools)
      .where(and(eq(tools.versionId, evalVersionId), ...))  // ❌ 用实时 versionId
  : [];
```

## 3. Location（定位）

### 功能模块
Eval 评估系统 — Run 创建与 Case 执行

### 代码定位
- `web/src/app/api/eval/run/route.ts:57` — 创建 run 时解析了 versionId 但未存入 run 记录
- `web/src/app/api/eval/run/route.ts:116-146` — run 记录缺少 versionId 字段
- `web/src/lib/eval/execute-case.ts:136` — case 执行时重新实时解析 versionId
- `web/src/lib/eval/execute-case.ts:137` — 用实时 versionId 加载 templateData
- `web/src/lib/eval/execute-case.ts:155-159` — 用实时 versionId 查询 tools
- `web/src/db/schema.ts:717-747` — evalRuns 表无 versionId 列

### 根因分析
`evalRuns` 表设计时只考虑了快照 modelConfig 的三个字段（modelId、systemPrompt、temperature），遗漏了 `versionId`。而 `resolveEditingVersionId()` 是对 `agents.editingVersionId` 的实时查询，该字段会随用户发布/切换版本而变化。

执行链路：
```
route.ts → resolveEditingVersionId → 读 modelConfig → 快照到 run ✅
                                                          ↓
                                              versionId 未写入 run ❌
                                                          ↓
eval-case-worker.ts → executeCase → resolveEditingVersionId（再次实时查询）❌
                                        ↓
                         gatherTemplateData(实时 versionId) → datasets/wiki/functions/schemas
                         db.select(tools).where(实时 versionId) → tools
```

两次 `resolveEditingVersionId` 调用之间存在时间窗口（分钟到小时级），任何对 agent editingVersionId 的变更都会导致 case 执行时使用与 systemPrompt 不一致的资源。

## 4. Impact（影响）

### 严重度
主要（Major）

### 影响范围
所有使用 Eval 功能的用户，在 eval 运行期间有版本变更操作时必现。

### 影响描述
- Eval 结果不可靠：不同 case 可能使用不同版本的资源执行，失去了 eval 的"控制变量"意义
- systemPrompt 引用不匹配：Liquid 模板变量（如 `{{ tool_names }}`、dataset 变量）可能渲染失败或引用到不存在的资源
- 难以发现：用户看到的是 eval case 失败或评分异常，但不会意识到是版本漂移导致
- 同一 run 内结果不一致：先执行的 case 和后执行的 case 可能基于不同版本，破坏了对比基础

## 修复方向

在 run 创建时快照 `versionId`，case 执行时使用快照值而非实时查询。

- **DB schema**：`evalRuns` 表新增 `chatVersionId` 列（`uuid`，nullable for backward compat）
- **Run 创建**（`route.ts`）：将 `versionId` 写入 run 记录
- **Case 执行**（`execute-case.ts`）：从 `run.chatVersionId` 读取，不再调用 `resolveEditingVersionId`
- **最小改动**：3 个文件（schema.ts + route.ts + execute-case.ts），加一次 db-push
- **风险**：低，仅影响 eval 链路，不影响 chat/publish
- **验收标准**：Given 一个正在运行的 eval run，When 用户切换 Agent 的编辑版本，Then 该 run 的所有 case 仍然使用 run 创建时的版本资源执行

## 过程备注

- [确认] 用户提供的 Hypothesis 完全正确，代码调研逐行验证通过
- [确认] `gatherTemplateData` 用 versionId 加载 7 类资源（datasets/wiki/tools/schemas/functions/ontology/objectRelations），漂移影响面广
- [确认] `buildDynamicTools` 也接收 versionId 参数，同样受影响
