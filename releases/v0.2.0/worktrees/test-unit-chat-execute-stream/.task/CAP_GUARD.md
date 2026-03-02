# 需求守护规约：Chat 流式执行核心逻辑单元测试

> 生成时间：2026-03-02
> 关联需求：[REQ.md](REQ.md)
> 关联实现：[IMPL_REPORT.md](IMPL_REPORT.md)
> 关联验收：[ACCEPT_REPORT.md](ACCEPT_REPORT.md)
> 分支：`dev-test-unit-chat-execute-stream-20260302`

## 1. Capability（能力宣言）

保护 `executeChatStream` 函数的 6 大逻辑域不退化：工具三源发现、Memory/RAG 注入、模板渲染、上下文压缩、消息持久化时序、错误处理。任何对该函数的重构或扩展，如果破坏了这些行为，24 个测试中至少有一个会失败。

**特殊性**：本次需求的实现产物本身就是测试代码，因此实现即守护——无需额外编写守护测试。

## 2. Criteria Matrix（标准矩阵）

| # | 验收标准 | Given | When | Then | Level | Test Case |
|---|----------|-------|------|------|-------|-----------|
| 1 | Host tool 过滤 | 3 tools 含 1 未注册 host | registeredHostTools=["host_ok"] | payload 不含 host_missing | Unit | `filters out unregistered host tools` |
| 2 | MCP 工具合并 | mcpEnabled + 1 server 返回 search | executeChatStream | tools 含 mcp_svc__search | Unit | `merges MCP tools with correct prefix` |
| 3 | MCP 连接失败 | mcpEnabled + createMCPClient 拒绝 | executeChatStream + onFinish | 事件含 mcp_connect_error | Unit | `records mcp_connect_error` |
| 4 | Skills 注入 | skillsEnabled + 1 skill | executeChatStream | tools 含 get_skill_detail, system 含 key | Unit | `injects get_skill_detail` |
| 5 | RAG 注入 | ragEnabled + ragConfig | executeChatStream | tools 含 rag_search | Unit | `injects rag_search` |
| 6 | Memory system_prompt | memoryEnabled + injectionMode=system_prompt | executeChatStream | system 含 memoryBlock | Unit | `appends memory to system prompt` |
| 7 | Memory context | memoryEnabled + injectionMode=context | executeChatStream | messages[0] 为 system memoryBlock | Unit | `prepends memory as system message` |
| 8 | Template hostContext | hostContext 存在 | executeChatStream | renderTemplate 收到 { host } | Unit | `passes hostContext to renderTemplate` |
| 9 | 压缩触发 | lastInputTokens 超阈值 + msgs > 4 | executeChatStream | compressMessages + saveCompressionData | Unit | `triggers compression` |
| 10 | 压缩跳过 | lastInputTokens 未超阈值 | executeChatStream | compressMessages 未调用 | Unit | `skips compression` |
| 11 | 压缩摘要注入 | compressionData 有 summary | executeChatStream | messages[0] 含 summary | Unit | `injects compression summary` |
| 12 | hostContext 超限 | anonymous + >10KB | executeChatStream | 400 + error 消息 | Unit | `returns 400 for oversized hostContext` |
| 13 | hostContext 通过 | authenticated + 小 context | executeChatStream | status ≠ 400 | Unit | `accepts hostContext within limit` |
| 14 | QuotaExceeded | streamText 抛 QuotaExceededError | executeChatStream | 402 + quota_exceeded | Unit | `returns 402 for QuotaExceededError` |
| 15 | 通用异常 | streamText 抛 Error | executeChatStream | rethrow + stream_error 事件 | Unit | `rethrows generic errors` |
| 16 | 持久化容错 | createSession 抛异常 | executeChatStream | status 200 | Unit | `tolerates persistence failure` |

## 3. Journey Test（旅程测试）

无——本需求为纯单元测试，无 E2E 用户旅程。测试代码的"旅程"等价于：`make test` 全部通过 + 新增测试覆盖 6 大逻辑域。

## 4. Constraint Guard（约束守卫）

| # | 约束 | Given | When | Then | Level | Test Case |
|---|------|-------|------|------|-------|-----------|
| 1 | 现有测试通过 | 原有 6 个 test case | make test | 全部 ✅ | Unit | 原有 describe 块 |
| 2 | 不修改源码 | execute-stream.ts | git diff | 无改动 | 静态 | git 记录 |
| 3 | 测试文件位置 | 测试文件 | 检查路径 | `__tests__/execute-stream.test.ts` | 静态 | 文件存在 |

## 5. Degradation Fence（退化围栏）

| # | Known Gap | 底线 | Level | 说明 |
|---|-----------|------|-------|------|
| 1 | MCP tools() phase 错误未独立测试 | MCP 连接失败已测试（connect phase） | Unit | 已有 `records mcp_connect_error` 覆盖连接层 |
| 2 | Memory extraction 未独立验证 | memory 模块自身测试范畴 | N/A | 超出本需求 scope |

## 6. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 状态 |
|------|----------|------|------|------|
| AC-1 | filters out unregistered host tools | execute-stream.test.ts | Unit | ✅ |
| AC-2 | merges MCP tools with correct prefix | execute-stream.test.ts | Unit | ✅ |
| AC-3 | records mcp_connect_error | execute-stream.test.ts | Unit | ✅ |
| AC-4 | injects get_skill_detail | execute-stream.test.ts | Unit | ✅ |
| AC-5 | injects rag_search | execute-stream.test.ts | Unit | ✅ |
| AC-6 | appends memory to system prompt | execute-stream.test.ts | Unit | ✅ |
| AC-7 | prepends memory as system message | execute-stream.test.ts | Unit | ✅ |
| AC-8 | passes hostContext to renderTemplate | execute-stream.test.ts | Unit | ✅ |
| AC-9 | triggers compression | execute-stream.test.ts | Unit | ✅ |
| AC-10 | skips compression | execute-stream.test.ts | Unit | ✅ |
| AC-11 | injects compression summary | execute-stream.test.ts | Unit | ✅ |
| AC-12 | returns 400 for oversized hostContext | execute-stream.test.ts | Unit | ✅ |
| AC-13 | accepts hostContext within limit | execute-stream.test.ts | Unit | ✅ |
| AC-14 | returns 402 for QuotaExceededError | execute-stream.test.ts | Unit | ✅ |
| AC-15 | rethrows generic errors | execute-stream.test.ts | Unit | ✅ |
| AC-16 | tolerates persistence failure | execute-stream.test.ts | Unit | ✅ |
| Constraint-1 | 原有 6 个 test case | execute-stream.test.ts | Unit | ✅ |
| Degradation-1 | records mcp_connect_error (connect phase) | execute-stream.test.ts | Unit | ✅ |
