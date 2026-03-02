# 需求报告：Chat 流式执行核心逻辑单元测试

> 创建时间：2026-03-02
> 分支：`dev-test-unit-chat-execute-stream-20260302`

## 1. Who（主体 + 场景）

### 使用者
开发者——维护和迭代 `executeChatStream` 函数的工程师。

### 使用场景
重构或扩展聊天流式执行逻辑时，需要单元测试保障回归安全。当前仅有 5 个基础测试（持久化时序 + no_model_config 错误），542 行核心代码的大量分支路径缺乏覆盖。

## 2. Why（动机）

### 痛点
`execute-stream.ts` 是产品核心路径——所有聊天对话都经过此函数。542 行代码涵盖工具发现、Memory/RAG 注入、模板渲染、上下文压缩、消息持久化、错误处理等 6 大逻辑域，但仅有 1 个 describe 块 + 5 个 test case，覆盖面严重不足。

### 做了的价值
每个逻辑分支都有测试守护，重构/新增功能时能快速发现回归，减少手动验证成本。

### 不做的代价
任何改动都依赖人工 E2E 验证，容易引入隐蔽 bug（如 Memory 注入位置错误、压缩阈值判断失效、MCP 连接失败未优雅降级等）。

## 3. What（能力声明）

### 核心能力
在现有测试基础设施（mock 体系）之上，补充以下 6 个逻辑域的单元测试：

1. **工具三源发现**：验证私有工具、MCP 工具、Host 工具的发现/过滤/合并逻辑，以及 Skills 和 RAG 工具的条件注入
2. **Memory/RAG 注入**：验证 Memory 在 `system_prompt` 和 `context` 两种模式下的注入位置正确性
3. **模板渲染**：验证 `gatherTemplateData` → `renderTemplate` → `disposeTemplateData` 的调用链，hostContext 传递
4. **上下文压缩**：验证压缩触发条件判断、消息截取范围、摘要生成与持久化
5. **消息持久化时序**：现有测试已覆盖基础场景，补充边界 case（持久化失败不影响流式响应）
6. **错误处理**：验证 hostContext 超限 400、QuotaExceededError 402、通用异常 rethrow + 事件记录

### 不做（Out of Scope）
- 不修改 `execute-stream.ts` 源码
- 不做集成测试或 E2E 测试
- 不测试被 mock 掉的依赖内部逻辑（如 `buildDynamicTools` 的工具构建细节）

## 4. Acceptance（验收标准）

- [ ] 工具发现：Given agent 有 3 个 enabled tools（含 1 个 host tool），When registeredHostTools 仅包含其中 1 个，Then 传给 buildDynamicTools 的 payload 过滤掉未注册的 host tool
- [ ] MCP 工具：Given mcpEnabled=true 且有 2 台 MCP server（1 台连接成功、1 台失败），Then 成功的 server 工具被合并到 allTools，失败的记录 mcp_connect_error 事件
- [ ] Skills 工具：Given skillsEnabled=true 且有 enabled skills，Then systemPrompt 追加技能摘要，allTools 包含 get_skill_detail
- [ ] RAG 工具：Given ragEnabled=true 且 ragConfig 存在，Then allTools 包含 rag_search
- [ ] Memory system_prompt 模式：Given memoryEnabled=true 且 injectionMode="system_prompt"，Then 渲染后的 systemPrompt 末尾追加 memoryBlock
- [ ] Memory context 模式：Given memoryEnabled=true 且 injectionMode="context"，Then modelMessages 前插入 system role 的 memoryBlock 消息
- [ ] 模板渲染：Given hostContext 存在，Then renderTemplate 收到 `{ host: hostContext }` 作为额外变量
- [ ] 上下文压缩触发：Given contextCompressionEnabled=true 且 lastInputTokens 超阈值且 messages 数量 > KEEP_RECENT_COUNT，Then 调用 compressMessages 并 saveCompressionData
- [ ] 上下文压缩跳过：Given lastInputTokens 未超阈值，Then 不调用 compressMessages
- [ ] 压缩摘要注入：Given compressionData 有 summary，Then modelMessages 前插入 conversation_summary system 消息
- [ ] hostContext 超限：Given anonymous 用户 + hostContext > 10KB，Then 返回 400
- [ ] hostContext 通过：Given authenticated 用户 + hostContext < 512KB，Then 正常流式响应
- [ ] QuotaExceededError：Given resolveModel 或 streamText 抛出 QuotaExceededError，Then 返回 402
- [ ] 通用异常：Given streamText 抛出普通 Error，Then 记录 stream_error 事件并 rethrow
- [ ] 持久化失败容错：Given createSession 抛异常，Then 不影响后续 streamText 调用（仅 console.error）
- [ ] disposeTemplateData 调用：Given onFinish 触发，Then after() 中调用 disposeTemplateData

## 5. Constraint（约束）

### 技术约束
- 复用现有 mock 基础设施（vi.mock 声明），通过 `vi.mocked()` 在各 test case 中定制返回值
- 测试文件位置固定：`web/src/lib/chat/__tests__/execute-stream.test.ts`
- 使用 Vitest + 项目约定的测试模式
- DB mock 使用现有的链式调用模式（select→from→where→limit）

### 不可打破的现有行为
- 现有 5 个测试必须继续通过
- 不修改源码 `execute-stream.ts`

## 参考
- 源码：`web/src/lib/chat/execute-stream.ts`（542 行）
- 现有测试：`web/src/lib/chat/__tests__/execute-stream.test.ts`（330 行，5 个 case）
- 压缩模块：`web/src/lib/chat/compress.ts`
- Memory 模块：`web/src/lib/memory/retrieve.ts`, `format-for-injection.ts`
- 池查询：`web/src/lib/pool/queries.ts`

## 过程备注
- 任务描述已明确 6 个测试维度，跳过采访直接调研+收敛
