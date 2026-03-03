# 缺陷报告：Judge systemPrompt 渲染使用被评估 agent 的 templateData，而非 judge agent 自身的

> 诊断时间：2026-03-03 21:00
> 环境：dev | 分支 `dev-eval-judge-system-prompt-uses-wrong-template-data-20260303`

## 1. Delta（偏差）

### 期望行为（Should Be）
Judge agent 的 systemPrompt 中 Liquid 变量应使用 judge agent 自身的数据集、Wiki、工具等 templateData 进行渲染。例如 judge agent 拥有数据集 `scoring_criteria`，则 `{{ scoring_criteria }}` 应解析为 judge 自身数据集的内容。

### 实际行为（Is）
Judge systemPrompt 使用**被评估 agent** 的 templateData 渲染。如果 judge systemPrompt 引用了仅存在于 judge agent 的变量（如评分标准数据集），会渲染为**空字符串**。

### 偏差描述
`executeCase` 只为被评估 agent gather 了 templateData，judge systemPrompt 复用了这份错误的数据，导致 judge 独有的模板变量全部丢失。

## 2. Reproduction Path（复现路径）

### 环境与前置条件
- 系统：任意（纯后端逻辑 bug）
- 数据依赖：
  1. 被评估 Agent A，拥有数据集 `dataset_a`
  2. Judge Agent J，拥有数据集 `scoring_criteria`（不存在于 Agent A）
  3. Judge Agent J 的 Model Config 中 systemPrompt 包含 `{{ scoring_criteria }}`
  4. 配置好的 Judge Config（含评分维度）
  5. 至少一个 Eval Case 带 expectedOutput

### 操作步骤
1. 在 Agent A 的 Eval 页面配置 Judge 为 Agent J
2. 运行 Eval
3. 查看 judge 评分结果 → judge 收到的 system prompt 中 `{{ scoring_criteria }}` 被渲染为空

### 复现证据

本 bug 为纯后端数据流逻辑问题，可通过代码静态分析确认：

**关键代码路径**：

```typescript
// execute-case.ts:134-136 — 只为被评估 agent gather templateData
const evalAgentId = run.agentId ?? undefined;
const evalVersionId = run.chatVersionId ?? undefined;
const templateData = await gatherTemplateData(evalAgentId, evalVersionId);
```

```typescript
// execute-case.ts:331-335 — judge systemPrompt 复用了被评估 agent 的 templateData
system: await renderTemplate(
  judgeSystemPrompt,
  templateData,  // ← 错误：这是被评估 agent 的数据
  { ...templateVars, model: chatModel, caseName: evalCase.name, toolNames }
),
```

同样的问题出现在 case-level judge（第 381-385 行）。

## 3. Location（定位）

### 功能模块
Eval 执行引擎 → Judge 评分流程

### 代码定位
- `web/src/lib/eval/execute-case.ts:136` — `gatherTemplateData` 只为 `evalAgentId` / `evalVersionId` 收集数据
- `web/src/lib/eval/execute-case.ts:331-335` — sequential 模式 per-turn judge 的 system 参数，复用被评估 agent 的 templateData
- `web/src/lib/eval/execute-case.ts:381-385` — case-level judge 的 system 参数，同样复用错误的 templateData
- `web/src/db/schema.ts:730` — `evalRuns` 表有 `judgeAgentId` 但**没有 `judgeVersionId`**
- `web/src/app/api/eval/run/route.ts:77` — run 创建时 `judgeVersionId` 已解析但未持久化到 run 记录中

### 根因分析

**根因**：`executeCase` 中只调用了一次 `gatherTemplateData`，传入的是被评估 agent 的 ID 和 versionId（第 136 行）。Judge agent 的 templateData 从未被收集。当渲染 `judgeSystemPrompt` 时（第 331-335 行、第 381-385 行），直接复用了被评估 agent 的 `templateData`，导致 judge agent 独有的数据集/Wiki/工具变量全部无法解析。

**深层原因**：`evalRuns` 表只存储了 `judgeAgentId`（第 730 行），没有 `judgeVersionId` 字段。而 `gatherTemplateData` 需要 `agentId` 和 `versionId` 两个参数才能查询正确的版本化资源。虽然在 run 创建时（`route.ts:77`）已经解析了 `judgeVersionId`，但没有持久化到 run 记录中，导致执行时无法获取 judge 的 versionId。

## 4. Impact（影响）

### 严重度
主要（Major）

### 影响范围
所有使用 judge agent systemPrompt 模板变量的用户

### 影响描述
- Judge systemPrompt 中引用 judge 自身数据集的变量全部渲染为空
- Judge 在评分时丢失关键上下文（如评分标准、评判维度说明等），评分结果不准确
- 无绕行方案：将评分标准数据集挂到被评估 agent 会污染其提示词上下文，违背 judge 与被评估 agent 职责分离的设计

## 修复方向

### 最小改动

1. **Schema 变更**：`evalRuns` 表新增 `judgeVersionId` 字段（`uuid("judge_version_id")`），与 `chatVersionId` 对称
2. **Run 创建**：在 `route.ts` 和 `batch/route.ts` 中将已解析的 `judgeVersionId` 写入 run 记录
3. **执行时**：在 `executeCase` 中为 judge agent 单独 `gatherTemplateData`，用于渲染 `judgeSystemPrompt`
4. **资源释放**：在 `finally` 块中同时 `disposeTemplateData(judgeTemplateData)`

### 风险
- Schema 变更需要 `db-push`（工作区）或迁移文件（dev/main）
- judge templateData 额外一次 DB 查询，影响可忽略（每个 run 级别，非 case 级别热路径）

### 验收标准
- Given judge agent 拥有独有数据集 `scoring_criteria`, When judge systemPrompt 包含 `{{ scoring_criteria }}`, Then 渲染结果包含该数据集的实际内容（非空）
- Given 被评估 agent 拥有数据集 `dataset_a`, When judge systemPrompt 包含 `{{ dataset_a }}`, Then 渲染结果为空（judge 不应访问被评估 agent 的数据）

## 过程备注

[确认] 用户提供的 Hypothesis 完全正确——通过代码静态分析确认根因，无需 Playwright UI 复现（bug 无 UI 表征，仅影响传给 LLM 的 system prompt 内容）
[确认] 发现 `judgeVersionId` 在 run 创建时已解析但未持久化，是修复的关键前置条件
