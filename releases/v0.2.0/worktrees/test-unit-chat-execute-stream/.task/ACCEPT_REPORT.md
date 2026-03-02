# 验收报告：Chat 流式执行核心逻辑单元测试

> 验收时间：2026-03-02
> 关联需求：[REQ.md](REQ.md)
> 关联实现：[IMPL_REPORT.md](IMPL_REPORT.md)
> 分支：`dev-test-unit-chat-execute-stream-20260302`

## 1. Criteria Verdict（标准裁定）

### 逐项核对

| # | 验收标准 | 结论 | 证据 |
|---|----------|------|------|
| 1 | Host tool 过滤：3 tools 含 1 host, registeredHostTools=["host_ok"], buildDynamicTools 不含 host_missing | ✅ 通过 | L447-468: 3 tool mock → payload 仅含 server_tool + host_ok |
| 2 | MCP 工具合并：mcpEnabled + 1 server 成功, tools 含 mcp_svc__search | ✅ 通过 | L470-490: createMCPClient mock → capturedStreamOpts.tools 检查 |
| 3 | MCP 连接失败：1 server 失败, 记录 mcp_connect_error 事件 | ✅ 通过 | L492-522: mockRejectedValue → onFinish flush → 事件断言 |
| 4 | Skills 注入：skillsEnabled=true, tools 含 get_skill_detail, system 含 key | ✅ 通过 | L524-540: skillRows mock → tools + system 双断言 |
| 5 | RAG 注入：ragEnabled=true + ragConfig, tools 含 rag_search | ✅ 通过 | L542-557: ragConfig mock → tools 断言 |
| 6 | Memory system_prompt：memoryEnabled + injectionMode=system_prompt, system 含 memoryBlock | ✅ 通过 | L574-591: retrieveMemories mock → system 字符串检查 |
| 7 | Memory context：injectionMode=context, messages[0] 为 system role memoryBlock | ✅ 通过 | L593-610: convertToModelMessages 返回新数组 → messages[0] 精确匹配 |
| 8 | Template hostContext：renderTemplate 收到 { host: hostCtx } | ✅ 通过 | L626-642: renderTemplate.mock.calls 参数匹配 |
| 9 | 压缩触发：lastInputTokens 超阈值 + messages > KEEP_RECENT_COUNT → compressMessages + saveCompressionData | ✅ 通过 | L683-707: shouldCompress=true → 双函数调用断言 |
| 10 | 压缩跳过：lastInputTokens 未超阈值 → compressMessages 未调用 | ✅ 通过 | L709-727: shouldCompress=false → not.toHaveBeenCalled |
| 11 | 压缩摘要注入：compressionData 有 summary → messages[0] 含 conversation_summary | ✅ 通过 | L729-750: compressedCount=2 → 消息切片 + summary 注入 |
| 12 | hostContext 超限 400：anonymous + >10KB → 400 | ✅ 通过 | L766-784: 200×100byte 值 → status 400 + error 消息 |
| 13 | hostContext 通过：authenticated + 小 context → 非 400 | ✅ 通过 | L786-798: userId="user-1" + 小对象 → status ≠ 400 |
| 14 | QuotaExceededError 402：streamText 抛 QuotaExceededError → 402 | ✅ 通过 | L800-816: mockImplementationOnce throw → status 402 + error code |
| 15 | 通用异常 rethrow：streamText 抛普通 Error → rethrow + stream_error 事件 | ✅ 通过 | L818-841: rejects.toThrow + 事件断言 |
| 16 | 持久化失败容错：createSession 抛异常 → 不影响 streamText | ✅ 通过 | L843-856: mockRejectedValueOnce → status 200 |

### 结果
✅ 全部通过（16/16 条）

## 2. Experience Validation（体验验证）

### 开发者旅程

以维护开发者视角审查测试代码质量：

| 维度 | 结果 | 说明 |
|------|------|------|
| Happy Path | ✅ | 24 个测试全部通过，覆盖 6 大逻辑域 |
| 代码可读性 | ✅ | describe 按逻辑域分组、命名清晰；setupDbMock helper 声明式配置比 callCount 更直观 |
| Mock 正确性 | ✅ | table-dispatched DB mock 按 from(table) 引用分发，与源码 DB 查询顺序解耦；convertToModelMessages 在需要检查 messages 的 describe 中返回新数组避免跨测试污染 |
| 维护性 | ✅ | 新增逻辑域只需在 setupDbMock 添加配置项 + 新 describe；不修改现有测试结构 |

### 标准覆盖反馈
无未覆盖问题。Acceptance 标准与实际测试一一对应。

### 结果
✅ 通过

## 3. Gap Assessment（缺口评估）

### 声明的缺口

| 缺口 | 类型 | 影响面 | 严重度 | 紧迫度 | 判定 |
|------|------|--------|--------|--------|------|
| MCP tools() phase 错误未独立测试 | 已知限制 | 仅影响 MCP tools 获取失败场景 | 体验瑕疵 | 可搁置 | ✅ 不阻塞 |
| Memory extraction（onFinish）未独立验证 | 已知限制 | memory 模块自身测试范畴 | 极端情况 | 可搁置 | ✅ 不阻塞 |

### 发现的缺口
无

### 结果
✅ 可接受——两个缺口均为边缘场景，不影响核心逻辑守护。

## 4. Regression Result（回归验证）

### 静态检查
- `make typecheck`：✅ 通过
- `make test`：✅ 1324 passed（6 failed 为 DB 依赖测试 `partial-unique-index.test.ts` + `seed-idempotency.test.ts`，需要运行中的数据库，与本次改动无关）

### Constraint 合规
| # | 约束 | 结果 |
|---|------|------|
| 1 | 现有测试通过 | ✅ 原有 6 个 test case 全部通过 |
| 2 | 不修改源码 | ✅ `execute-stream.ts` 未改动（仅修改测试文件） |
| 3 | 测试文件位置 | ✅ `web/src/lib/chat/__tests__/execute-stream.test.ts` |
| 4 | 复用现有 mock 基础设施 | ✅ 所有 vi.mock 声明保持不变，通过 vi.mocked() 定制 |

### 结果
✅ 通过

## 5. Verdict（裁定）

### 判决
✅ 合并

### 证据摘要
- **Criteria Verdict**：16/16 条验收标准全部通过
- **Experience Validation**：测试代码可读、mock 正确、维护性好
- **Gap Assessment**：两个已知限制均为边缘场景，不阻塞
- **Regression**：typecheck + test 通过，现有测试无回归，源码未改动

### 阻塞项
无

### Follow-up 清单
无

## 过程备注
- 纯单元测试任务，无 UI 交互，跳过 Playwright 验证
- DB 依赖测试（partial-unique-index、seed-idempotency）在 worktree 中一直失败（无数据库），属于已知环境问题
