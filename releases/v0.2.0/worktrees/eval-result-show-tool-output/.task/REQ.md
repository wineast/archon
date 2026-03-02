# 需求报告：评估结果中展示工具调用输出

> 创建时间：2026-03-02 21:00
> 分支：`dev-eval-result-show-tool-output-20260302`

## 1. Who（主体 + 场景）

### 使用者
FDE（前沿部署工程师），在 Archon 平台上配置和调试子 Agent。

### 使用场景
FDE 运行评估（Eval）用例后查看运行结果，需要理解 Agent 的完整推理链路——包括工具调用了什么、传了什么参数、**返回了什么结果**。这是日常高频操作，每次调试都会反复查看。

## 2. Why（动机）

### 痛点
当前 eval 结果只展示工具名称和输入参数，**不展示工具返回的输出内容**。FDE 无法判断工具是否正确执行、返回了什么数据，只能看到 Agent "调了工具"但不知道"工具说了什么"，推理链路断裂。

### 做了的价值
FDE 能看到完整的 Agent 执行链路：用户输入 → Agent 思考 → 调用工具(参数) → **工具返回结果** → Agent 基于结果回复。调试效率显著提升。

### 不做的代价
FDE 调试 Agent 时只能靠猜测工具输出，或者需要去其他地方（如日志）手动查找，严重影响调试效率和体验。

## 3. What（能力声明）

### 核心能力

- **存储工具输出**：eval 运行时，将工具调用的返回结果（result）一并保存到数据库的 `chatMessages` 中，不再丢弃
- **展示工具输出**：在 ResultCard 的工具调用区域，展示每个工具调用对应的输出内容
- **折叠交互**：工具输出默认折叠，点击可展开查看完整内容（输出可能较长，如大段 JSON）

### 不做（Out of Scope）
- 不做工具输出的格式化渲染（如 JSON 高亮、表格化）——纯文本展示即可
- 不做工具输出的搜索/过滤功能
- 不改变现有的工具调用断言逻辑

## 4. Acceptance（验收标准）

- [ ] `ChatMessage.toolCalls` 类型包含可选的 `result` 字段
- [ ] eval 运行后，`evalRunResults.chatMessages` 中 assistant 消息的 `toolCalls` 包含 `result` 数据（从 `extractToolCalls()` 传递而来，不再丢弃）
- [ ] ResultCard 单轮模式（single）：工具调用下方可展开查看输出内容
- [ ] ResultCard 多轮模式（injected/sequential）：同上，每个工具调用都可展开查看输出
- [ ] 工具输出默认折叠，点击后展开显示完整文本
- [ ] 无工具输出时（`result` 为 undefined/空）不显示展开入口
- [ ] 现有 eval 运行流程、断言逻辑不受影响

## 5. Constraint（约束）

### 业务约束
- 展示的是运行时工具实际返回的数据，不做任何加工或过滤

### 技术约束
- `ChatMessage` 类型定义在 `web/src/lib/eval/types.ts:57-62`，修改时需保持向后兼容（旧数据无 result 字段，不应报错）
- 工具输出保存在 `evalRunResults.chatMessages` 的 jsonb 列中，无 schema 迁移——类型兼容即可
- `execute-case.ts` 中 `extractToolCalls()` 已提取 result，需在后续转换为 ChatMessage 时保留而非丢弃
- ResultCard 展示逻辑在 `web/src/components/eval/result-card.tsx`，单轮（169-188行）和多轮（102-121行）两处都需修改

### 不可打破的现有行为
- 工具调用的名称和参数展示保持不变
- eval 运行的执行流程、断言检查逻辑不变
- EvalTurn 中注入的 toolCalls（含 result）的处理逻辑不变

## 参考
- 类型定义：`web/src/lib/eval/types.ts`（ChatMessage:57, ToolCallRecord:40, EvalTurnToolCall:33）
- 运行时提取：`web/src/lib/eval/execute-case.ts`（extractToolCalls:23-39, 转换丢弃:206-208）
- 前端展示：`web/src/components/eval/result-card.tsx`（单轮:169-188, 多轮:102-121）
- Storybook：`web/src/components/eval/result-card.stories.tsx`

## 过程备注

- [确认] 代码调研发现 `extractToolCalls()` 已正确提取 tool result，问题仅在转换为 ChatMessage 时丢弃了 result 字段——修复范围明确且局部
