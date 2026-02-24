# 评测（Eval）模块

评测模块用于系统化测试 Agent 的回复质量，支持断言验证和 LLM 评审两种评估方式。

## 概念

| 概念 | 说明 |
|------|------|
| **Eval Case** | 测试用例，定义输入 + 预期输出 + 断言规则 |
| **Judge Agent** | 评审 Agent，通过 evaluator 功能槽位引用，提供模型配置和评分维度 |
| **Judge Config** | 评分维度配置（仅 name + dimensions），属于 Judge Agent，在 Build > Judge Tab 中管理 |
| **Eval Run** | 一次评测运行，包含多个用例的执行结果 |
| **Assertion** | 断言规则（文本断言 + 工具调用断言），用于自动判定通过/失败 |
| **Dimension** | 评审维度（如准确性、相关性），由 Judge LLM 打分 |

## 架构

评测系统采用 **Agent 分离架构**：

- **被测 Agent**：当前 Agent，使用自身的 Model Config 作为对话模型
- **Judge Agent**：通过 evaluator 功能槽位解析得到，提供评审模型配置（Model Config）和评分维度（Judge Config）

这种设计让任何 Agent 都能成为 Judge Agent，只需在功能槽位中配置即可。

## 测试用例模式

| 模式 | 说明 |
|------|------|
| **single** | 单轮对话：一问一答 |
| **injected** | 注入历史：所有 turn 构成消息历史，仅最后一条 user 消息触发 LLM |
| **sequential** | 多轮对话：每个 user turn 独立调用 LLM，逐轮执行 |

## 数据库 Schema

### evalCases 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| key | text | 用例唯一标识 |
| name | text | 用例名称 |
| mode | text | `single` / `injected` / `sequential` |
| turns | jsonb | 对话轮次 |
| expectedOutput | text | 预期输出 |
| assertions | jsonb | 断言规则列表 |
| tags | text[] | 标签（用于筛选） |

### evalRuns 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 被测 Agent |
| chatModel | text | 对话模型 ID |
| chatSystemPrompt | text | 对话系统提示词 |
| chatTemperature | real | 对话温度 |
| judgeAgentId | uuid | Judge Agent ID |
| judgeModelConfigSnapshot | jsonb | Judge 模型配置快照 |
| judgeConfigSnapshot | jsonb | Judge 评分维度快照 |
| totalCases | integer | 总用例数 |
| passedAssertions | integer | 通过断言数 |
| averageScore | real | 平均评分 |

> 运行记录通过快照保存所有配置（含 chatTemperature），确保历史记录不受后续修改影响。

### judgeConfigs 表

详见 [judge-config.md](./judge-config.md)

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/eval/cases?agentId=xxx` | 列出测试用例 |
| POST | `/api/eval/cases` | 创建用例 |
| PATCH | `/api/eval/cases/[id]` | 更新用例 |
| DELETE | `/api/eval/cases/[id]` | 删除用例 |
| POST | `/api/eval/run` | 创建评测运行记录（服务端自动解析 active 配置，请求只需 agentId + judgeAgentId） |
| POST | `/api/eval/run/[runId]/case` | 执行单个用例（从 run 记录读取配置快照，请求只需 case + templateVars + toolNames） |
| PATCH | `/api/eval/run/[runId]` | 完成运行（汇总统计） |
| GET | `/api/eval/runs?agentId=xxx` | 列出运行记录 |
| GET | `/api/eval/resolve-judge?agentId=xxx` | 解析 evaluator 槽位得到 Judge Agent |

## UI

在 Agent Build 页面侧栏中点击 **Evaluate**（烧瓶图标）进入：

- **Cases**：管理测试用例，支持 tag 筛选
- **Results**：运行评测并查看结果
  - Run All 按钮打开 **RunEvalDialog** 弹窗，选择 Judge Agent 和断言设置后确认执行
  - 被测 Agent 和 Judge Agent 的 Model Config / Judge Config 均自动使用 Active 配置，无需手动选择
  - 进度条 + 结果展示 + 历史记录
- **Benchmark**：趋势追踪、运行对比、跨模型分析（详见 [benchmark.md](./benchmark.md)）

Judge 配置（评分维度）在 Judge Agent 的 Build 页面 **Judge Tab** 中管理，详见 [judge-config.md](./judge-config.md)。

## 断言类型

### 文本断言

| 类型 | 说明 | value 格式 |
|------|------|-----------|
| `contains` | 回复包含指定文本（大小写不敏感） | 纯文本 |
| `not-contains` | 回复不包含指定文本 | 纯文本 |
| `regex` | 回复匹配正则表达式 | 正则表达式 |
| `length-min` | 回复长度 >= 指定值 | 数字 |
| `length-max` | 回复长度 <= 指定值 | 数字 |
| `json-valid` | 回复是合法 JSON | 无需填写 |

### 工具调用断言

| 类型 | 说明 | value 格式 |
|------|------|-----------|
| `tool-called` | AI 调用了指定工具 | 工具名，如 `getWeather` |
| `tool-not-called` | AI 未调用指定工具 | 工具名 |
| `tool-called-with-contains` | AI 调用了指定工具且参数包含子集 | `{"tool": "name", "args": {...}}` |
| `tool-called-with-exact` | AI 调用了指定工具且参数精确匹配 | `{"tool": "name", "args": {...}}` |

工具调用断言基于执行期间实际发生的 `generateText` 步骤中提取的 `ToolCallRecord[]`。

## EvalTurn 工具调用注入

`EvalTurn` 支持可选的 `toolCalls` 字段，用于在 injected/sequential 模式中注入包含工具调用的 assistant 历史：

```ts
interface EvalTurnToolCall {
  name: string;          // 工具名
  args: Record<string, unknown>; // 调用参数
  result: string;        // 工具返回结果
}
```

注入时，带 `toolCalls` 的 assistant turn 会被转换为 `AssistantModelMessage`（包含 text + tool-call parts）+ `ToolModelMessage`（包含 tool-result parts），确保 LLM 能正确理解历史中的工具调用上下文。

## 从聊天历史导入 Turns

手动创建包含工具调用的多轮对话评测用例较繁琐。可通过 **Import** 功能从 Request Inspector 的 Messages tab 复制 `UIMessage[]` JSON，快速转换为 `EvalTurn[]`。

### 操作步骤

1. 在聊天界面打开 Request Inspector → Messages tab
2. 复制完整的 `UIMessage[]` JSON
3. 在 Eval Case 编辑页，点击 turns 区域底部的 **Import** 按钮
4. 粘贴 JSON → 点击 Import

### 转换规则

- `system` 消息被跳过
- `text` parts 拼接为 turn 的 `content`（多个 text part 以换行连接）
- 静态工具（`tool-xxx`）和动态工具（`dynamic-tool`）均提取为 `toolCalls[]`
- 工具的 `input` 映射为 `args`，`output` 通过 `JSON.stringify` 映射为 `result`
- 如果已有 turns，导入会替换全部现有 turns

### 解析函数

`parseUIMessagesToTurns(messages: UIMessage[]): EvalTurn[]`（位于 `src/lib/eval/import-turns.ts`）
