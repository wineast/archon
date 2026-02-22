# 上下文压缩（Context Compression）

## 概述

当对话轮次增多，发送给模型的 input token 数会逼近上下文窗口上限。上下文压缩功能在检测到 token 数超过阈值时，自动将较早的对话压缩成摘要，保留最近的消息原文，从而让长对话能够持续进行。

## 开关

在 `agents` 表上通过 `contextCompressionEnabled` 字段控制（默认 `false`）。

- **关闭时**（默认）：零额外开销，所有消息原样发送给模型
- **开启时**：每次请求发送前检查是否需要压缩

## 工作流程

```
请求到达
  ↓
检查 agent.contextCompressionEnabled
  ↓ false → 原有逻辑
  ↓ true →
    加载 session.metadata.compression
      ↓
    检查 lastInputTokens（上次请求的 inputTokens）
      ↓ 超过阈值 → 在 streamText 前压缩旧消息，更新 session metadata
      ↓ 未超过 / 无数据 → 不压缩
      ↓
    裁剪已压缩的旧消息 + 注入摘要作为 system message
      ↓
  streamText(...)
      ↓
  onFinish → after() → 保存 lastInputTokens 到 session metadata
```

关键设计：**压缩在发送前执行**，确保本轮请求已使用压缩后的精简上下文，而非在 after() 中事后压缩（那样本轮已经发出了可能超长的请求）。

## 上下文窗口获取

优先级：`models` 表 `contextWindow` 字段 → `tokenlens` 库 → 128K fallback。

`models` 表的 `contextWindow` 列（integer, nullable）存储每个模型的上下文窗口大小（单位：token），通过 seed 数据维护。当 `tokenlens` 对新模型缺少数据时，以 DB 为准。

## 阈值

- 通过 `getInputMax(modelId)` 获取模型的有效上下文窗口
- 阈值 = `inputMax × 0.75`（预留 25% 给回复 + 安全余量）
- 当 `lastInputTokens > 阈值` 且消息数 > `KEEP_RECENT_COUNT (10)` 时触发

## 压缩策略

采用**递进式摘要**：

1. 保留最近 10 条 UIMessage（约 5 轮对话）原文不动
2. 更早的消息由小模型（`openai/gpt-4o-mini`）压缩成摘要
3. 下次再触发压缩时，将旧摘要 + 新增待压缩消息合并压缩为新摘要

## 数据存储

利用 `chatSessions.metadata` (jsonb) 的 `compression` 字段：

```ts
interface CompressionMetadata {
  summary: string;           // 压缩后的摘要
  compressedCount: number;   // 已压缩的消息数量（偏移量）
  lastCompressedAt: string;  // 最后压缩时间
  lastInputTokens?: number;  // 上次请求的 inputTokens，供下次判断是否压缩
}
```

`lastInputTokens` 在每次请求完成后通过 `after()` 异步保存，不阻塞流式响应。下次请求到达时读取此值判断是否需要压缩。

## 注入方式

摘要作为 `system` 角色消息注入到 modelMessages 最前面：

```xml
<conversation_summary>
{摘要内容}
</conversation_summary>
```

## 与 Memory 系统的关系

- **Memory**：提取离散的关键事实，跨会话持久化
- **上下文压缩**：将完整对话流压缩为摘要，仅在当前会话内生效
- 两者独立开关，互不影响，可以同时开启

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/lib/chat/compress.ts` | 压缩核心逻辑（`getInputMax`、`shouldCompress`、LLM 调用、数据读写） |
| `src/lib/chat/execute-stream.ts` | 集成点（发送前压缩 + after 保存 lastInputTokens） |
| `src/db/schema.ts` | `agents.contextCompressionEnabled` 字段、`models.contextWindow` 列 |
| `src/db/seed-data/models.json` | 模型上下文窗口数据 |

## 参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `COMPRESSION_MODEL` | `openai/gpt-4o-mini` | 压缩用的小模型 |
| `KEEP_RECENT_COUNT` | `10` | 保留最近消息数 |
| `THRESHOLD_RATIO` | `0.75` | 触发阈值比例 |
| `FALLBACK_INPUT_MAX` | `128,000` | DB + tokenlens 均无数据时的默认值 |
