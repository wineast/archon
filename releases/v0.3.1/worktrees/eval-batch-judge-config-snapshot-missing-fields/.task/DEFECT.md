# 缺陷报告：Batch 模式 judgeConfigSnapshot 丢失 promptTemplate / turnPromptTemplate

> 诊断时间：2026-03-02
> 环境：dev | 分支 `dev-eval-batch-judge-config-snapshot-missing-fields-20260302`

## 1. Delta（偏差）

### 期望行为（Should Be）
Batch 模式创建的每个 eval run 记录中，`judgeConfigSnapshot` 应包含完整的 judge 配置快照，包括 `name`、`dimensions`、`promptTemplate` 和 `turnPromptTemplate` 四个字段——与单次 run 模式行为一致。

### 实际行为（Is）
Batch 模式创建的 per-run 记录中，`judgeConfigSnapshot` 仅包含 `name` 和 `dimensions`，遗漏了 `promptTemplate` 和 `turnPromptTemplate`。下游 `execute-case.ts` 读取到 `undefined` 后 fallback 为 `null`，导致 `renderJudgePrompt` 使用默认模板而非用户自定义模板。

### 偏差描述
Batch 模式下自定义 judge prompt template 被静默丢弃，评估结果基于默认模板产生，用户无感知。

## 2. Reproduction Path（复现路径）

### 环境与前置条件
- 系统：任意
- 数据依赖：一个配置了自定义 `promptTemplate` / `turnPromptTemplate` 的 judge config
- 配置：judge agent 激活的 judge config 需有非空 promptTemplate

### 操作步骤
1. 创建 judge agent，配置 judge config 并设置自定义 `promptTemplate` 和/或 `turnPromptTemplate`
2. 通过 batch 模式发起评估（repeatCount >= 1）
3. 查看创建的 eval run 记录中 `judgeConfigSnapshot` 字段
4. → 发现 `promptTemplate` 和 `turnPromptTemplate` 字段缺失

### 复现证据

通过代码对比直接确认——无需 UI 复现：

**单次 run（正确）** — `web/src/app/api/eval/run/route.ts:130-135`：
```typescript
judgeConfigSnapshot: {
  name: judgeConfig.name,
  dimensions: judgeConfig.dimensions,
  promptTemplate: judgeConfig.promptTemplate,       // ✅ 存在
  turnPromptTemplate: judgeConfig.turnPromptTemplate, // ✅ 存在
},
```

**Batch per-run（缺陷）** — `web/src/app/api/eval/batch/route.ts:159-162`：
```typescript
judgeConfigSnapshot: {
  name: judgeConfig.name,
  dimensions: judgeConfig.dimensions,
  // ❌ 缺少 promptTemplate
  // ❌ 缺少 turnPromptTemplate
},
```

**Batch 级别记录** — `web/src/app/api/eval/batch/route.ts:127-130`：
```typescript
judgeConfigSnapshot: {
  name: judgeConfig.name,
  dimensions: judgeConfig.dimensions,
  // ❌ 同样缺少
},
```

**下游消费** — `web/src/lib/eval/execute-case.ts:128-131`：
```typescript
const judgeConfigSnapshot = run.judgeConfigSnapshot as {
  name: string; dimensions: Dimension[];
  promptTemplate?: string | null; turnPromptTemplate?: string | null
} | null;
const promptTemplate = judgeConfigSnapshot?.promptTemplate ?? null;       // → null
const turnPromptTemplate = judgeConfigSnapshot?.turnPromptTemplate ?? null; // → null
```

## 3. Location（定位）

### 功能模块
Eval 评估系统 — Batch 模式 run 创建

### 代码定位
- `web/src/app/api/eval/batch/route.ts:127-130` — batch 级 `judgeConfigSnapshot` 缺少 2 字段
- `web/src/app/api/eval/batch/route.ts:159-162` — per-run 级 `judgeConfigSnapshot` 缺少 2 字段
- `web/src/app/api/eval/run/route.ts:130-135` — 单次 run 的正确实现（参照）
- `web/src/lib/eval/execute-case.ts:128-131` — 下游消费方，读到 undefined 后 fallback 为 null
- `web/src/lib/eval/types.ts:98-104` — `JudgeConfigData` 类型定义（含 4 个字段）

### 根因分析
`batch/route.ts` 在创建 batch 记录和 per-run 记录时，手动构造 `judgeConfigSnapshot` 对象只复制了 `name` 和 `dimensions`，遗漏了 `promptTemplate` 和 `turnPromptTemplate`。这是 batch 功能开发时的复制遗漏——`run/route.ts` 有完整的 4 字段快照，batch 路由未同步。

## 4. Impact（影响）

### 严重度
主要

### 影响范围
所有使用 batch 模式 + 自定义 judge prompt template 的用户

### 影响描述
- **数据正确性**：batch 模式的评估结果基于默认模板而非用户配置的模板，评分标准与用户预期不一致
- **静默失败**：无任何错误提示，用户可能基于错误的评估结果做决策
- **单次 vs batch 不一致**：同一个 judge 配置在两种模式下产生不同评估行为

## 修复方向

在 `batch/route.ts` 的两处 `judgeConfigSnapshot` 构造中补上缺失的字段：

- **最小改动**：`web/src/app/api/eval/batch/route.ts` 两处，各加 2 行
- **风险**：极低，仅补全已有字段的复制
- **验收标准**：Given 配置了自定义 promptTemplate 的 judge config, When 通过 batch 模式发起评估, Then per-run 记录的 judgeConfigSnapshot 包含 promptTemplate 和 turnPromptTemplate 字段

## 过程备注

[确认] 通过代码对比即可确认根因，无需 UI 复现——`run/route.ts` 和 `batch/route.ts` 的 judgeConfigSnapshot 构造差异一目了然。
