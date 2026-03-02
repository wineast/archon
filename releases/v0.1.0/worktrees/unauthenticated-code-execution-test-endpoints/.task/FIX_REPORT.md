# 修复报告：工具/函数测试端点添加授权检查 + Code Scanner 拒绝解析失败代码

> 修复时间：2026-03-01 21:15
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 分支：`dev-unauthenticated-code-execution-test-endpoints-20260301`

## 1. Root Cause（根因）

### 为什么坏了
两个独立根因组合放大了风险：

1. **测试端点遗漏授权**：`/api/tools/test` 和 `/api/functions/test` 在开发时被视为"无状态测试工具"（不读写数据库），因此遗漏了 `requireAgentRole` 检查。但它们接收任意代码并通过 `new Function()` / `new AsyncFunction()` 在服务端执行，实际危害远超数据库 CRUD。

2. **Scanner 容错策略错误**：`scanCode()` 的 catch 分支假设"parse 不了的代码执行时也会失败"，但 `new Function()` 不要求 ES module 语法——acorn 以 `sourceType: "module"` 解析失败的代码，`new Function()` 仍可能成功执行。

### 因果链
1. 攻击者以已认证用户身份 POST `/api/tools/test`（或 `/api/functions/test`）
2. → 端点无 `requireAgentRole` 检查，直接进入代码执行流程
3. → 攻击者构造让 acorn module 解析器失败但 `new Function()` 仍可执行的代码
4. → `scanCode()` parse 失败返回 `ok: true`，安全规则（禁 process/require/eval 等）全部跳过
5. → 代码被 `new Function()` 执行，获得服务端 RCE

## 2. Change（变更）

### 修改摘要
为两个测试端点添加 `requireAgentRole(agentId, "editor")` 授权检查（要求请求体携带 `agentId`），并将 Code Scanner 的 parse 失败行为从放行改为拒绝。

### 修改明细
| 文件 | 改动 | 说明 |
|------|------|------|
| `web/src/app/api/tools/test/route.ts` | 添加 `agentId` 参数校验 + `requireAgentRole(agentId, "editor")` | 任何代码执行前必须验证调用者对目标 Agent 有 editor 权限 |
| `web/src/app/api/functions/test/route.ts` | 同上 | 与 tools/test 对齐 |
| `web/src/lib/code-scanner.ts:41-43` | `return { ok: true, errors: [] }` → `return { ok: false, errors: ["代码解析失败: ..."] }` | parse 失败不再放行，携带具体错误信息 |
| `web/src/lib/__tests__/code-scanner.test.ts:106-109` | 断言从 `ok: true` → `ok: false` + 检查错误信息包含"代码解析失败" | 测试与行为同步 |

## 3. Rationale（决策依据）

### 为什么选择此方案

**授权方案**：选择方案 A（要求传入 `agentId` + `requireAgentRole`）而非方案 B（仅 `requireAuth`）。原因：

- 与项目其他路由（如 `/api/tools/[id]`、`/api/mcp-servers/[id]/test`）的授权模式一致
- 确保多租户隔离——用户只能在自己有权限的 Agent 上下文中测试代码
- `requireAuth` 只验证登录态，无法阻止跨 Agent 的代码执行

**Scanner 方案**：直接返回 `ok: false` + 错误信息，而非尝试用另一种方式解析代码。原因：

- 简单可靠——parse 失败意味着代码不合规范，应该被前端提示修正
- 保持 scanner 的单一职责：基于 AST 的静态分析，不处理运行时兼容性

### 考虑过的替代方案
| 方案 | 未采用原因 |
|------|-----------|
| 仅 `requireAuth()` 验证登录态 | 无法阻止跨租户攻击，不符合最小权限原则 |
| 删除 `/api/tools/test` 和 `/api/functions/test` 端点 | 前端当前未使用这两个端点，但它们可能为未来的 playground 功能预留，删除可能影响后续开发 |
| Scanner 尝试用 `sourceType: "script"` 重新解析 | 增加复杂度，且仍无法覆盖所有 `new Function()` 能接受的代码格式 |

### 已知局限
- 前端当前未调用这两个端点（搜索未找到引用），因此授权改动不影响现有功能。但若后续前端开始调用，需在请求体中携带 `agentId`
- Scanner 改动后，含语法错误的代码在"测试执行"时会报"代码解析失败"而非具体的运行时错误——这是正确行为但用户体验略有变化

## 4. Blast Radius（影响范围）

### 直接影响
- `/api/tools/test` — 新增 `agentId` 必传参数 + 授权检查
- `/api/functions/test` — 同上
- `scanCode()` — parse 失败从放行变为拒绝
- 所有调用 `scanCode()` 的代码路径（`executeToolHandler`、`compileAndExecFn`、`createFunctionsExec`）— parse 失败的代码将被拒绝执行

### 间接影响
- 无。前端没有代码调用这两个 test 端点。`scanCode()` 的行为变化只影响含语法错误的代码，正常代码不受影响。

### 不影响
- `/api/tools/[id]/test-cases/run` — 使用 `executeToolHandler` 但入口有独立的工具 ID 校验
- `/api/functions/[id]/test-cases/run` — 同上
- `/api/chat/tools/build-dynamic-tools.ts` — chat 流程中的工具执行，有独立授权链路
- 正常代码的扫描和执行——`scanCode()` 对可正常解析的代码行为不变

## 5. Verification（验证方式）

### 静态检查
- `make typecheck`：通过
- `make test`：114 个测试文件全部通过

### 正向验证
1. 未认证用户 POST `/api/tools/test` → Clerk 中间件返回 404（拦截）
2. 未认证用户 POST `/api/functions/test` → 同上
3. 代码修改确认：两个端点在解析请求体后、执行代码前，先校验 `agentId` 非空（400），再调用 `requireAgentRole(agentId, "editor")`（401/403）
4. `scanCode()` 对语法错误代码返回 `ok: false` + 错误信息（测试验证）

### 回归验证
- `code-scanner.test.ts`：13 个测试全部通过，包括更新后的语法错误测试
- `exec.test.ts`：所有 compileAndExecFn 测试通过（正常代码不受影响）
- `execute-handler.test.ts`：所有 executeToolHandler 测试通过

## 过程备注

- [确认] 前端代码中未发现任何对 `/api/tools/test` 和 `/api/functions/test` 的调用——这两个端点可能是早期开发遗留，或为未来 playground 预留
- [确认] `/api/mcp-servers/[id]/test/route.ts` 已有正确的授权检查模式（先查 DB 获取 agentId，再 `requireAgentRole`），本次修复采用了更简单的方式（直接从请求体获取 agentId），因为 test 端点不操作特定的 DB 资源
