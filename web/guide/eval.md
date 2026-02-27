# 评测（Eval）模块

评测模块用于系统化测试 Agent 的回复质量，支持断言验证和 LLM 评审两种评估方式。

## 概念

| 概念 | 说明 |
|------|------|
| **Eval Case** | 测试用例，定义输入 + 预期输出 + 断言规则 |
| **Judge Agent** | 评审 Agent，通过 evaluator 功能槽位引用，提供模型配置和评分维度 |
| **Judge Config** | 评分配置（name + dimensions + prompt 模板），属于 Judge Agent，在 Build > Judge Tab 中管理。详见 [judge-config.md](./judge-config.md) |
| **Eval Batch** | 一次评测批次，包含 1-10 个 Run，用于评估稳定性 |
| **Eval Run** | 一次评测运行，包含多个用例的执行结果 |
| **Assertion** | 断言规则（文本断言 + 工具调用断言），用于自动判定通过/失败 |
| **Dimension** | 评审维度（如准确性、相关性），由 Judge LLM 打分，支持自定义 min/max 分数范围（默认 0-10，可配为 0-1 二元评估） |

## 架构

评测系统采用 **Agent 分离架构**：

- **被测 Agent**：当前 Agent，使用自身的 Model Config 作为对话模型
- **Judge Agent**：通过 evaluator 功能槽位解析得到，提供评审模型配置（Model Config）和评分维度（Judge Config）

这种设计让任何 Agent 都能成为 Judge Agent，只需在功能槽位中配置即可。

### 服务端执行引擎（Inngest）

评测运行由 **Inngest** 事件驱动框架异步执行，前端仅发起创建请求并通过 SWR 轮询获取进度。

#### 两层编排：Batch → Run → Case

所有评测运行归属于 **Batch**（批次）。单次执行是 `repeatCount=1` 的 batch，自动展平为单 run 显示；`repeatCount>1` 时展示聚合视图。

**Batch 层**（`eval-batch-orchestrator`）：
1. 前端 `POST /api/eval/batch`，传入 `cases`、`templateVars`、`toolNames`、`repeatCount`（1-10）、`runConcurrency`（1-5）
2. 服务端创建 `evalBatches` 记录 + N 个 `evalRuns` 记录（`status: "pending"`），发送 `eval/batch.created` Inngest 事件
3. **eval-batch-orchestrator** 接收事件，按 `runConcurrency` 将 runs 分批
4. 每批前检查 batch 是否被取消，然后将批内 runs 设为 "running"
5. 通过 `step.invoke(evalOrchestrator)` 并行调用每个 run 的编排器
6. 批完成后更新 `completedRuns`
7. 全部完成后调用 `finalizeBatch(batchId)` 聚合统计

**Run 层**（`eval-orchestrator` + `eval-case-worker`，无需修改）：
1. eval-orchestrator 加载 run 配置和 orgId，将 caseIds 按 `concurrency`（1-5，默认 3）分批
2. 每批前通过 `step.run("check-cancel-N")` 检查 DB 取消标志
3. 批内通过 `step.invoke()` + `Promise.all()` 并行调用 **eval-case-worker**
4. eval-case-worker 每个 case 分三步：`load` → `execute` → `save`
5. 全部批次完成后 `step.run("finalize")` 聚合统计

**关键好处**：
- 刷新/离开页面不丢失运行状态——进度持久化在 DB
- 无 120s 超时限制——Inngest 函数不受 Vercel serverless 时间约束
- 无竞态条件——finalize 在所有 worker 完成后执行
- 自动重试——case worker 配置 3 次重试，`onConflictDoUpdate` 保证幂等
- 支持 Cancel——`POST /api/eval/batch/{batchId}/cancel` 取消 batch + 所有 pending/running runs
- 支持 Retry Failed——`POST /api/eval/run/{runId}/retry-failed` 删除失败结果并重新发送事件
- 同一 Agent 不能同时运行两个 Batch（409 并发检查）
- 超过 30 分钟的 running batch 自动标记为 `failed`
- **稳定性评估**：`repeatCount>1` 时，batch finalize 计算聚合统计（均分、标准差、最低/最高分），量化 Agent 输出稳定性

**本地开发**：`make up` 已包含 Inngest Dev Server（Worktree 端口从 `meta.json` 读取，主仓库默认 8288）。也可独立启动：`make inngest-dev`

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

### evalBatches 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 被测 Agent |
| repeatCount | integer | 重复次数（1-10） |
| runConcurrency | integer | Run 并发数（1-5，默认 1） |
| chatModel | text | 对话模型 ID 快照 |
| judgeConfigSnapshot | jsonb | Judge 评分维度快照（用于 scoreMax 计算） |
| totalCasesPerRun | integer | 每个 run 的 case 数 |
| status | text | `pending` / `running` / `completed` / `cancelled` / `failed` |
| completedRuns | integer | 已完成 run 数 |
| totalRuns | integer | 总 run 数 |
| passedAssertions | integer | 通过断言数（N=1 直接用，N>1 所有 run 求和） |
| averageScore | real | 平均评分（N=1 直接用，N>1 所有 run 平均） |
| scoreStdDev | real | 评分标准差（仅 N>1） |
| minScore | real | 最低 run 均分 |
| maxScore | real | 最高 run 均分 |
| isBaseline | boolean | 是否为基线 |
| error | text | 错误信息 |

### evalRuns 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 被测 Agent |
| batchId | uuid | 所属 Batch（FK → evalBatches，级联删除） |
| runIndex | integer | 在 batch 内的序号（0-based） |
| chatModel | text | 对话模型 ID |
| chatSystemPrompt | text | 对话系统提示词 |
| chatTemperature | real | 对话温度 |
| judgeAgentId | uuid | Judge Agent ID |
| judgeModelConfigSnapshot | jsonb | Judge 模型配置快照 |
| judgeConfigSnapshot | jsonb | Judge 评分维度快照 |
| templateVars | jsonb | 模板变量快照（使 run 自包含，支持 retry） |
| toolNames | text[] | 工具名列表快照 |
| concurrency | integer | 并发数（1-5，默认 3） |
| totalCases | integer | 总用例数 |
| passedAssertions | integer | 通过断言数 |
| averageScore | real | 平均评分 |
| status | text | `pending` / `running` / `completed` / `cancelled` / `failed` |
| completedCases | integer | 已完成用例数 |
| error | text | 错误信息 |

> 运行记录通过快照保存所有配置（含 chatTemperature），确保历史记录不受后续修改影响。

### judgeConfigs 表

详见 [judge-config.md](./judge-config.md)

## API

### Batch 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/eval/batch` | 创建 batch（含 N 个 run），替代原 POST /api/eval/run |
| GET | `/api/eval/batches?agentId=xxx` | 列出 batch 记录（自动超时降级 30min+ running → failed） |
| GET | `/api/eval/batches/[id]` | Batch 详情（含所有 runs） |
| DELETE | `/api/eval/batches/[id]` | 删除 batch（级联删除 runs + results） |
| PATCH | `/api/eval/batches/[id]` | 更新 batch（`isBaseline` 切换） |
| POST | `/api/eval/batch/[batchId]/cancel` | 取消 batch + 所有 pending/running runs |

### Case 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/eval/cases?agentId=xxx` | 列出测试用例 |
| POST | `/api/eval/cases` | 创建用例 |
| PATCH | `/api/eval/cases/[id]` | 更新用例 |
| DELETE | `/api/eval/cases/[id]` | 删除用例 |

### Run 端点（保留）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/eval/run` | 创建单次运行（并发检查已改为检查 running batch） |
| POST | `/api/eval/run/[runId]/case` | 执行单个用例（调试用） |
| PATCH | `/api/eval/run/[runId]` | 完成运行（汇总统计） |
| POST | `/api/eval/run/[runId]/cancel` | 取消单个 run |
| POST | `/api/eval/run/[runId]/retry-failed` | 重跑失败 case |
| GET | `/api/eval/runs?agentId=xxx` | 列出 run 记录 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/eval/resolve-judge?agentId=xxx` | 解析 evaluator 槽位得到 Judge Agent |

## UI

在 Agent Build 页面侧栏中点击 **Evaluate**（烧瓶图标）进入：

- **Cases**：管理测试用例，支持 tag 筛选
- **Results**：运行评测并查看结果
  - Run All / Run 按钮打开 **RunEvalDialog** 弹窗，配置：
    - Judge Agent（通过 evaluator 槽位自动选择）
    - 用例并发数（1-5，默认 3）
    - **重复次数**（1-10，默认 1）——同一组 case 重复执行 N 次
    - **Run 并发数**（1-5，默认 1，仅重复次数 >1 时显示）
    - 断言设置
  - 确认后创建 Batch，包含 N 个 Run
  - 被测 Agent 和 Judge Agent 的 Model Config / Judge Config 均自动使用 Active 配置
  - 运行中显示进度条（`completedRuns / totalRuns`），支持 Stop 按钮取消
  - **N=1 展平显示**：与原单 run 完全一致——时间戳、模型名、状态、passRate、score
  - **N>1 聚合视图**：Header 显示 "×N" badge，聚合统计（avg score ± stdDev, min~max），展开后显示各 run 折叠列表
  - History 列表显示 batches（替代原来的 runs），支持 Baseline、Delete 操作
  - 刷新页面后自动恢复运行状态（DB 驱动）
  - `cancelled` / `failed` 状态有对应 badge 标识
- **Benchmark**：趋势追踪、运行对比、跨模型分析（详见 [benchmark.md](./benchmark.md)）

### 报告页

#### Run Report

独立全屏页面，URL 格式：`/{orgSlug}/{agentSlug}/eval/{runId}`

- 顶部导航栏：返回按钮 → Build Eval Tab、Agent 名称 + "Eval Report"
- 汇总区：模型名、运行时间、状态 badge、通过率、平均分
- Running 状态时显示进度条，3 秒自动刷新
- 下方为 ResultCard 列表，展示每个 case 的完整结果
- 组织内成员可通过 URL 直接查看
- 入口：展开 batch → 单 run 详情区 / per-run 折叠项中的 ExternalLinkIcon

#### Batch Report

独立全屏页面，URL 格式：`/{orgSlug}/{agentSlug}/eval/batch/{batchId}`

- 顶部导航栏：返回按钮 → Build Eval Tab、Agent 名称 + "Batch Report"
- 汇总区：模型名、运行时间、状态 badge、重复次数（x{N}）、通过率、平均分（N>1 附加 ±stdDev）
- Running 状态时显示进度条（completedRuns/totalRuns），3 秒自动刷新
- **N=1 展平**：直接显示单个 run 的 ResultCard 列表（同 Run Report）
- **N>1 聚合**：聚合统计卡片（Avg Pass Rate / Avg Score / Std Dev / Range）+ 每个 run 可折叠展开查看 ResultCard
- 入口：History 列表中 batch header 上的 ExternalLinkIcon 按钮

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

## 单元测试（Inngest 函数）

使用 `@inngest/test`（`InngestTestEngine`）+ Vitest mock 测试 Inngest 执行引擎。

### 测试文件

- `web/src/inngest/functions/__tests__/eval-orchestrator.test.ts` — Run 编排器（分批、取消、finalize）
- `web/src/inngest/functions/__tests__/eval-case-worker.test.ts` — Case Worker（执行、保存、用量记录）
- `web/src/lib/eval/__tests__/execute-batch.test.ts` — Batch 辅助函数（isBatchCancelled、finalizeBatch）
- `web/src/app/api/eval/run/[runId]/retry-failed/__tests__/retry-failed.test.ts` — Retry Failed API

### 测试策略

- **Batch Orchestrator**：mock DB + isBatchCancelled + finalizeBatch，验证 runConcurrency 分批、cancel 检查、completedRuns 更新
- **Run Orchestrator**：mock 依赖（DB、isRunCancelled、finalizeRun），let step handlers 运行原始代码；`step.invoke` 通过 `InngestTestEngine` 的 `steps` 选项 mock
- **Case Worker**：mock DB 链式操作（sequential select results）、executeCase、recordUsage，let 所有 step handlers 运行原始代码
- **Retry Failed**：传统 vi.mock DB + inngest.send，直接测试 route handler

### Known Issue

`retry-failed` route 中 `inngest.send()` 在 DB 操作之后调用，send 失败时状态已被污染（results 已删除、status 已更新为 running）。应将 `inngest.send` 移到 DB 操作之前或用事务包裹。

## E2E 测试

评估模块有完整的 Playwright E2E 测试，覆盖从创建 Agent 到运行评估并查看结果的全流程。

### 运行

```bash
make e2e-eval
```

### 测试文件

- `web/e2e/eval-flow.spec.ts` — 冒烟测试（single 模式、1 case、contains 断言 + judge + 报告页验证）
- `web/e2e/eval-full.spec.ts` — 综合测试（8 case 批量运行，覆盖 single/sequential/injected 三种模式 + regex 断言 + tool-called 断言 + 断言失败场景 + tool call 历史注入 + UIMessage[] 导入 + tag 筛选 + tag 筛选后 Run All + 报告页验证）
- `web/e2e/eval-judge-skip.spec.ts` — Judge 跳过测试（无 expectedOutput 时跳过 judge 评审 + 报告页验证）
- `web/e2e/eval-binary.spec.ts` — 二元评估测试（binary scoring 0/1，验证 min/max 维度配置 + 分数显示格式 x/1 + 报告页验证）
- `web/e2e/eval-concurrency.spec.ts` — 并发数配置测试（RunEvalDialog 设置 concurrency=1 + 运行 + 报告页验证 concurrency 显示）
- `web/e2e/eval-cancel.spec.ts` — 取消运行测试（5 case concurrency=1 顺序执行 + 等待 run 开始 + 点击 Stop + 验证 Cancelled 状态）
- `web/e2e/eval-batch-repeat.spec.ts` — 批量重复执行测试（repeatCount=3 + 运行中状态验证 + 完成后聚合统计 + per-run 展开验证 + batch report 报告页验证）

所有 eval E2E 测试的最后一步都会在报告页上验证 pass rate、score 和 result card 数量（cancel 测试除外，因为取消后不产生完整结果）。

### 配置

- **Playwright project**: `eval`（独立于 `authenticated` project）
- **超时**: 600 秒（10 分钟，综合测试包含 2 轮 Run All 需要更长时间）
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
1. 环境准备同上（步骤 1-7）+ 创建 `get_lucky_number` 工具
2. 创建 8 个用例（每个附带 tag）：
   - `math_basic`（single，contains "4"）[tag: math] — 预期通过
   - `capital_regex`（single，regex "Paris"）[tag: math] — 预期通过
   - `fail_case`（single，contains "banana"）[tag: math] — 预期失败
   - `seq_memory`（sequential，2 轮对话，Turn 2 contains "Alice" + judge）[tag: context] — 预期通过
   - `injected_ctx`（injected，注入历史 + 最后提问，contains "7890"）[tag: context] — 预期通过
   - `tool_call`（single，tool-called "get_lucky_number"）[tag: tool] — 预期通过
   - `injected_tool_ctx`（injected，assistant turn 含 tool call 历史，contains "42"）[tag: tool] — 预期通过
   - `import_test`（injected，通过 Import 导入 UIMessage[] JSON，contains "2"）[tag: math] — 预期通过
3. Tag 筛选验证：切换 math/tool tag 检查 Run All 按钮显示的 case 计数
4. Tagged Run All（math，4 case）→ 验证 pass rate 3/4
5. Clear tags → Full Run All（全部 8 case）→ 验证 pass rate 7/8 + 评分

### 种子数据

测试使用 `yarnb@foxmail.com`（Clerk ID: `user_39qe7YIgMr9IabPpiCxLLmBqUVU`）作为普通测试用户，已添加到 `web/src/db/seed-data/users.json`。运行测试前确保执行过 `make db-seed`。
