# 用量计费系统

## 概述

统计平台上所有 LLM 调用的 token 用量和费用，按 Agent / 用户 / 模型维度聚合，支持 Blob 存储统计，提供 Dashboard 可视化。

## 数据模型

### usageRecords 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| agentId | UUID FK | 关联 Agent |
| userId | TEXT (nullable) | Clerk 用户 ID，embed 匿名调用为 null |
| sessionId | UUID FK (nullable) | 关联会话 |
| modelId | TEXT | 模型标识（如 claude-sonnet-4-20250514） |
| inputTokens | INTEGER | 输入 token 数 |
| outputTokens | INTEGER | 输出 token 数 |
| cachedInputTokens | INTEGER | 缓存命中 token 数 |
| reasoningTokens | INTEGER | 推理 token 数 |
| costUSD | NUMERIC | 费用（美元），由 tokenlens 计算 |
| source | ENUM | 来源：chat / embed / prompt-assist / eval |
| createdAt | TIMESTAMP | 记录时间 |

### 存储统计

不需要新表，直接从 `agentFiles` 表聚合 `SUM(size) GROUP BY agentId`。

## 埋点位置

4 个 LLM 调用入口：

1. **execute-stream.ts** — 主对话 + embed 对话，`onFinish` 的 `after()` 中写入
2. **prompt-assist/route.ts** — 提示词辅助
3. **eval/run/[runId]/case/route.ts** — 评估运行（含 judge 模型调用）

费用计算使用 `tokenlens` 包的 `getUsage()` 函数。

## API

- `GET /api/usage/summary` — 按 agent/user/时间/source 过滤的汇总
- `GET /api/usage/records` — 分页明细
- `GET /api/usage/storage` — Blob 存储统计

## 权限

仅 platform admin 或 agent owner 可查看用量数据。
