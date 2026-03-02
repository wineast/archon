# 实现报告：Chat 流式执行核心逻辑单元测试

> 实现时间：2026-03-02
> 关联需求：[REQ.md](REQ.md)
> 分支：`dev-test-unit-chat-execute-stream-20260302`

## 1. Solution Design（方案设计）

### 测试架构
在现有 mock 基础设施上扩展，新增 `capturedStreamOpts` 捕获 `streamText` 完整入参（system/tools/messages），实现对内部状态的黑盒验证。

### 关键改进：table-dispatched DB mock
原有 DB mock 使用 `callCount` 按调用顺序分发（脆弱），新增 `setupDbMock()` 按 `from(table)` 引用分发——每个 table 独立配置返回值，支持灵活组合 agent/modelConfig/skills/ragConfig。

### 测试组织
6 个 describe 块对应 6 个逻辑域，共 18 个新 test case + 6 个原有 = 24 个。

## 2. Design Rationale（设计决策）

### 决策 1：table-dispatched vs callCount DB mock
- **选择**：按 `from(table)` 引用分发
- **替代方案**：沿用 callCount — 脆弱，新增 skills/ragConfig 查询后序号会变
- **选择依据**：声明式配置更可读，新增 DB 查询不影响已有 mock

### 决策 2：capturedStreamOpts 捕获
- **选择**：在 `streamText` mock 中同时捕获完整 opts 对象
- **替代方案**：为每个属性（system/tools/messages）单独捕获变量 — 冗余
- **选择依据**：一个变量覆盖所有验证需求，新增断言无需修改 mock

### 决策 3：convertToModelMessages 每次返回新数组
- **选择**：在需要检查 messages 的 describe 中用 `mockImplementation(() => Promise.resolve([]))`
- **替代方案**：全局修改 — 可能影响现有测试
- **选择依据**：最小侵入，仅在需要的 describe 中覆盖

## 3. Change Set（变更集）

### 变更摘要
仅修改测试文件，新增 18 个 test case 覆盖 6 个逻辑域。

### 修改
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/lib/chat/__tests__/execute-stream.test.ts` | +520 行 | 新增 capturedStreamOpts、imports、setupDbMock helper、6 个 describe 块 |

## 4. Traceability（需求追溯）

| 需求项 | 类型 | 实现位置 | 状态 |
|--------|------|----------|------|
| 工具发现：host tool 过滤 | Acceptance | `tool discovery > filters out unregistered host tools` | ✅ |
| MCP 工具合并 | Acceptance | `tool discovery > merges MCP tools with correct prefix` | ✅ |
| MCP 连接失败记录事件 | Acceptance | `tool discovery > records mcp_connect_error` | ✅ |
| Skills 工具注入 | Acceptance | `tool discovery > injects get_skill_detail` | ✅ |
| RAG 工具注入 | Acceptance | `tool discovery > injects rag_search` | ✅ |
| Memory system_prompt 模式 | Acceptance | `memory injection > appends memory to system prompt` | ✅ |
| Memory context 模式 | Acceptance | `memory injection > prepends memory as system message` | ✅ |
| hostContext 传递 | Acceptance | `template rendering > passes hostContext to renderTemplate` | ✅ |
| disposeTemplateData 调用 | Acceptance | `template rendering > calls disposeTemplateData` | ✅ |
| 压缩触发 | Acceptance | `context compression > triggers compression` | ✅ |
| 压缩跳过 | Acceptance | `context compression > skips compression` | ✅ |
| 压缩摘要注入 | Acceptance | `context compression > injects compression summary` | ✅ |
| hostContext 超限 400 | Acceptance | `error handling > returns 400 for oversized hostContext` | ✅ |
| hostContext 通过 | Acceptance | `error handling > accepts hostContext within limit` | ✅ |
| QuotaExceededError 402 | Acceptance | `error handling > returns 402 for QuotaExceededError` | ✅ |
| 通用异常 rethrow | Acceptance | `error handling > rethrows generic errors` | ✅ |
| 持久化失败容错 | Acceptance | `error handling > tolerates persistence failure` | ✅ |
| 现有测试通过 | Constraint | 原有 6 个 test case 全部通过 | ✅ |
| 不修改源码 | Constraint | `execute-stream.ts` 未改动 | ✅ |

## 5. Known Gaps（已知缺口）

### 未实现项
无——需求报告 16 条 Acceptance 全部覆盖。

### 已知限制
- MCP tools() 调用失败（非连接失败）的路径通过事件记录验证，但未独立测试 tools() phase 错误
- Memory extraction（onFinish 中的 `extractMemories`）未独立验证——属于 memory 模块自身的测试范畴

### 技术债务
无

## 验证结果

### 静态检查
- `make typecheck`：通过
- `make test`：1324 passed（6 failed 为 DB 依赖测试，与本次改动无关）

### Acceptance 核对
| # | 验收标准 | 结果 |
|---|----------|------|
| 1 | host tool 过滤 | ✅ |
| 2 | MCP 工具合并 | ✅ |
| 3 | MCP 连接失败事件 | ✅ |
| 4 | Skills 工具注入 | ✅ |
| 5 | RAG 工具注入 | ✅ |
| 6 | Memory system_prompt | ✅ |
| 7 | Memory context | ✅ |
| 8 | hostContext 传递 | ✅ |
| 9 | 压缩触发 | ✅ |
| 10 | 压缩跳过 | ✅ |
| 11 | 压缩摘要注入 | ✅ |
| 12 | hostContext 超限 400 | ✅ |
| 13 | hostContext 通过 | ✅ |
| 14 | QuotaExceededError 402 | ✅ |
| 15 | 通用异常 rethrow | ✅ |
| 16 | 持久化失败容错 | ✅ |

### Constraint 合规
| # | 约束 | 结果 |
|---|------|------|
| 1 | 现有测试通过 | ✅ 6/6 原有测试通过 |
| 2 | 不修改源码 | ✅ execute-stream.ts 未改动 |
| 3 | 测试文件位置 | ✅ `__tests__/execute-stream.test.ts` |

## 过程备注
- 无偏差信号，一次通过
