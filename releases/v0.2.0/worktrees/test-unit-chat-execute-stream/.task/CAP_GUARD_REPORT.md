# 需求守护报告：Chat 流式执行核心逻辑单元测试

> 执行时间：2026-03-02
> 关联规约：[CAP_GUARD.md](CAP_GUARD.md)
> 分支：`dev-test-unit-chat-execute-stream-20260302`

## 1. 规约概要

### Capability
保护 `executeChatStream` 函数的 6 大逻辑域不退化：工具三源发现、Memory/RAG 注入、模板渲染、上下文压缩、消息持久化时序、错误处理。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Criteria Matrix | 16 | 18 | 18 | 0 |
| Journey Test | 0 | 0 | — | — |
| Constraint Guard | 3 | 3 | 3 | 0 |
| Degradation Fence | 2 | 1 | 1 | 0 |

## 2. 测试结果

### 静态检查
- `make typecheck`：✅ 通过
- `make test`：✅ 1324 passed（6 failed 为 DB 依赖测试，与本次无关）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `web/src/lib/chat/__tests__/execute-stream.test.ts` | 24 | 24 | 0 | AC-1~16, Constraint-1~3, Degradation-1 |

### E2E 测试
无——纯单元测试需求，无 E2E 场景。

## 3. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 层级 | 结果 |
|------|----------|------|------|
| AC-1 | filters out unregistered host tools | Unit | ✅ |
| AC-2 | merges MCP tools with correct prefix | Unit | ✅ |
| AC-3 | records mcp_connect_error | Unit | ✅ |
| AC-4 | injects get_skill_detail | Unit | ✅ |
| AC-5 | injects rag_search | Unit | ✅ |
| AC-6 | appends memory to system prompt | Unit | ✅ |
| AC-7 | prepends memory as system message | Unit | ✅ |
| AC-8 | passes hostContext to renderTemplate | Unit | ✅ |
| AC-9 | triggers compression | Unit | ✅ |
| AC-10 | skips compression | Unit | ✅ |
| AC-11 | injects compression summary | Unit | ✅ |
| AC-12 | returns 400 for oversized hostContext | Unit | ✅ |
| AC-13 | accepts hostContext within limit | Unit | ✅ |
| AC-14 | returns 402 for QuotaExceededError | Unit | ✅ |
| AC-15 | rethrows generic errors | Unit | ✅ |
| AC-16 | tolerates persistence failure | Unit | ✅ |
| Constraint-1 | 原有 6 个 test case 全部通过 | Unit | ✅ |
| Constraint-2 | execute-stream.ts 未修改 | 静态 | ✅ |
| Constraint-3 | 测试文件位于 __tests__/ | 静态 | ✅ |
| Degradation-1 | MCP connect phase 错误已覆盖 | Unit | ✅ |
| Degradation-2 | Memory extraction（scope 外） | N/A | — |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Criteria Matrix**：16/16 条全部覆盖，18 个测试用例通过
- **Journey Test**：不适用（纯单元测试需求）
- **Constraint Guard**：3/3 条全部满足
- **Degradation Fence**：1/2 条覆盖（另 1 条超出 scope）

### 未覆盖项
- Degradation-2（Memory extraction）：属于 memory 模块自身测试范畴，超出本需求 scope

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| `web/src/lib/chat/__tests__/execute-stream.test.ts`（修改） | Unit | +18（总 24） |

## 过程备注
- 本需求的实现产物即测试代码，守护规约直接映射到已实现的测试用例，无需额外编写守护测试
