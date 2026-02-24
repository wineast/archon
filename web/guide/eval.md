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

### 服务端执行引擎

评测运行由**服务端异步执行**，前端仅发起创建请求并通过 SWR 轮询获取进度：

1. 前端 `POST /api/eval/run`，传入 `cases`、`templateVars`、`toolNames`
2. 服务端创建 `evalRuns` 记录（`status: "running"`），在 `after()` 中启动 `executeEvalRun()`
3. 执行引擎使用 `p-limit(3)` 并发控制，逐个执行用例（调用 `executeCase()`），每完成一个原子递增 `completedCases`
4. 每个用例执行前检查 `status === "cancelled"`，如是则跳过
5. 全部完成后 `finalizeRun()` 聚合统计，设置最终状态（`completed` / `cancelled`）
6. 前端 `useEvalRuns` 在检测到 running 状态时自动 2s 轮询刷新

**关键好处**：
- 刷新/离开页面不丢失运行状态——进度持久化在 DB
- 支持 Cancel——前端调用 `POST /api/eval/run/{runId}/cancel` 设置 `status: "cancelled"`
- 同一 Agent 不能同时运行两个 Run（409 并发检查）
- 超过 30 分钟的 running run 自动标记为 `failed`

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
| status | text | 运行状态：`pending` / `running` / `completed` / `cancelled` / `failed` |
| completedCases | integer | 已完成用例数（用于进度展示） |
| error | text | 错误信息（仅 `failed` 状态） |

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
| POST | `/api/eval/run` | 创建运行并启动服务端异步执行（请求需 agentId + judgeAgentId + cases + templateVars + toolNames） |
| POST | `/api/eval/run/[runId]/case` | 执行单个用例（保留供调试，从 run 记录读取配置快照） |
| PATCH | `/api/eval/run/[runId]` | 完成运行（汇总统计，单用例场景使用） |
| POST | `/api/eval/run/[runId]/cancel` | 取消运行中的 run |
| GET | `/api/eval/runs?agentId=xxx` | 列出运行记录（自动超时降级 30min+ running → failed） |
| GET | `/api/eval/resolve-judge?agentId=xxx` | 解析 evaluator 槽位得到 Judge Agent |

## UI

在 Agent Build 页面侧栏中点击 **Evaluate**（烧瓶图标）进入：

- **Cases**：管理测试用例，支持 tag 筛选
- **Results**：运行评测并查看结果
  - Run All 按钮打开 **RunEvalDialog** 弹窗，选择 Judge Agent 和断言设置后确认执行
  - 被测 Agent 和 Judge Agent 的 Model Config / Judge Config 均自动使用 Active 配置，无需手动选择
  - 运行中显示进度条（`completedCases / totalCases`），支持 Stop 按钮取消
  - 运行中的 run 在 History 列表中带 `Running x/y` badge，自动展开并轮询加载已完成结果
  - 刷新页面后自动恢复运行状态（DB 驱动）
  - `cancelled` / `failed` 状态有对应 badge 标识
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

## E2E 测试

评估模块有完整的 Playwright E2E 测试，覆盖从创建 Agent 到运行评估并查看结果的全流程。

### 运行

```bash
make e2e-eval
```

### 测试文件

- `web/e2e/eval-flow.spec.ts` — 冒烟测试（single 模式、1 case、contains 断言 + judge）
- `web/e2e/eval-full.spec.ts` — 综合测试（5 case 批量运行，覆盖 single/sequential/injected 三种模式 + regex 断言 + 断言失败场景）

### 配置

- **Playwright project**: `eval`（独立于 `authenticated` project）
- **超时**: 300 秒（5 分钟，真实 API 调用较慢）
- **视频录制**: 默认开启，录制文件保存在 `web/test-results/`
- **视口**: 1440 x 900

### 环境变量

E2E 测试需要 `web/e2e/.env` 文件（已 gitignore）：

```
E2E_CLERK_USER_USERNAME=yarnb@foxmail.com
E2E_CLERK_USER_PASSWORD=archon123456Aa.
E2E_DEEPSEEK_API_KEY=<your-deepseek-api-key>
```

### 测试流程

**eval-flow.spec.ts（冒烟测试）**：
1. 登录 → 进入 Agents 首页
2. 创建被测 Agent
3. 到组织设置 → 配置 DeepSeek API Key
4. 回到被测 Agent → 创建 DeepSeek Model Config
5. 回到首页 → 创建 Judge Agent
6. Judge Agent → 创建 DeepSeek Model Config
7. Judge Agent → Judge Tab → 创建 Judge Config（Accuracy 维度）
8. 回到被测 Agent → Eval Tab
9. 创建 Eval Case（"2+2=?" + contains "4" 断言）
10. 切到 Results → Run All → 选择 Judge Agent → 确认
11. 等待服务端执行完成
12. 验证结果（pass rate + score 显示）

**eval-full.spec.ts（综合测试）**：
1. 环境准备同上（步骤 1-7）
2. 创建 5 个用例：
   - `math_basic`（single，contains "4"）— 预期通过
   - `capital_regex`（single，regex "Paris"）— 预期通过
   - `fail_case`（single，contains "banana"）— 预期失败
   - `seq_memory`（sequential，2 轮对话，Turn 2 contains "Alice" + judge）— 预期通过
   - `injected_ctx`（injected，注入历史 + 最后提问，contains "7890"）— 预期通过
3. Run All → 选择 Judge Agent → 确认
4. 验证：至少 3/5 通过、存在 Passed 和 Failed badge、有评分

### 种子数据

测试使用 `yarnb@foxmail.com`（Clerk ID: `user_39qe7YIgMr9IabPpiCxLLmBqUVU`）作为普通测试用户，已添加到 `web/src/db/seed-data/users.json`。运行测试前确保执行过 `make db-seed`。
