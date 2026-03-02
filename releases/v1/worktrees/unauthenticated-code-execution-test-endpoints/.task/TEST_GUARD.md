# 测试守护规约：测试端点授权 + Code Scanner fail-closed

> 生成时间：2026-03-01 21:30
> 关联缺陷：[DEFECT.md](DEFECT.md)
> 关联修复：[FIX_REPORT.md](FIX_REPORT.md)
> 关联验证：[VERIFY_REPORT.md](VERIFY_REPORT.md)
> 分支：`dev-unauthenticated-code-execution-test-endpoints-20260301`

## 1. Invariant（不变量）

**工具/函数测试端点必须验证 Agent editor 权限后才执行代码；Code Scanner 必须拒绝无法解析的代码。**

来源：DEFECT.md Delta 取反

## 2. Trigger Scenario（触发场景）

### Scenario A: tools/test 端点授权

#### Given
POST 请求到达 `/api/tools/test`

#### When
请求体缺少 `agentId`

#### Then
返回 400 `{ success: false, error: "agentId is required" }`，`executeToolHandler` 不被调用

### Scenario B: functions/test 端点授权

#### Given
POST 请求到达 `/api/functions/test`

#### When
请求体缺少 `agentId`

#### Then
返回 400 `{ success: false, error: "agentId is required" }`，`compileAndExecFn` 不被调用

**Level**: Integration（mock auth + 测试 route handler）
**来源**: DEFECT.md Path → 精简

## 3. Cause Anchor（根因锚点）

### 故障机制 1：scanner parse 失败放行
原 `scanCode()` 在 acorn parse 失败时返回 `ok: true`，绕过所有安全检查。

### 锚点断言
`scanCode(syntaxErrorCode)` 必须返回 `{ ok: false, errors: [...] }`

**Level**: Unit
**来源**: FIX_REPORT.md Root Cause + Change（已被 `code-scanner.test.ts` 第 106-110 行覆盖）

### 故障机制 2：test 端点缺少 requireAgentRole
原 route handler 直接调用执行函数，不校验权限。

### 锚点断言
route handler 在 `executeToolHandler`/`compileAndExecFn` 之前调用 `requireAgentRole`；当 `requireAgentRole` 返回 NextResponse（401/403）时，route handler 直接返回该响应，不执行代码。

**Level**: Integration
**来源**: FIX_REPORT.md Root Cause + Change

## 4. Boundary Set（边界集）

| # | 变体 | 来源 | Level |
|---|------|------|-------|
| 1 | 缺少 agentId → 400 | 验证报告 | Integration |
| 2 | agentId 为非字符串类型 → 400 | 验证报告 | Integration |
| 3 | requireAgentRole 返回 403 → 传递 403 | Root Cause 推导 | Integration |
| 4 | requireAgentRole 返回 401 → 传递 401 | Root Cause 推导 | Integration |
| 5 | 授权通过但缺少 handler/code → 400 | Root Cause 推导 | Integration |
| 6 | 授权通过且参数完整 → 正常执行 | Root Cause 推导 | Integration |

## 5. Blast Shield（防爆盾）

| # | 区域 | 断言 | 来源 | Level |
|---|------|------|------|-------|
| 1 | scanCode 正常代码 | `scanCode(validCode).ok === true` | FIX_REPORT Blast Radius | Unit |
| 2 | executeToolHandler 正常执行 | 正常代码通过 scan + 执行得到预期结果 | FIX_REPORT Blast Radius | Unit |
| 3 | compileAndExecFn 正常执行 | 正常代码通过 scan + 执行得到预期结果 | FIX_REPORT Blast Radius | Unit |

注：Blast Shield #1-3 已被现有测试覆盖（code-scanner.test.ts "passes clean code"、exec.test.ts、execute-handler.test.ts），不额外新增。

## 6. Coverage Matrix（覆盖矩阵）

| 守护元素 | 测试用例 | 层级 | 状态 |
|---------|---------|------|------|
| Trigger A | tools/test: 缺少 agentId 返回 400 | Integration | ⏳ |
| Trigger B | functions/test: 缺少 agentId 返回 400 | Integration | ⏳ |
| Cause Anchor 1 | scanCode: 语法错误返回 ok: false | Unit | ✅ 已有 |
| Cause Anchor 2a | tools/test: requireAgentRole 返回 403 时不执行代码 | Integration | ⏳ |
| Cause Anchor 2b | functions/test: requireAgentRole 返回 403 时不执行代码 | Integration | ⏳ |
| Boundary 1 | 缺少 agentId → 400 | Integration | ⏳ |
| Boundary 2 | agentId 为 number → 400 | Integration | ⏳ |
| Boundary 3 | requireAgentRole 返回 403 | Integration | ⏳ |
| Boundary 4 | requireAgentRole 返回 401 | Integration | ⏳ |
| Boundary 5 | 授权通过但缺少 handler/code → 400 | Integration | ⏳ |
| Boundary 6 | 授权通过且参数完整 → 正常执行 | Integration | ⏳ |
| Blast Shield 1 | scanCode 正常代码返回 ok: true | Unit | ✅ 已有 |
| Blast Shield 2 | executeToolHandler 正常执行 | Unit | ✅ 已有 |
| Blast Shield 3 | compileAndExecFn 正常执行 | Unit | ✅ 已有 |
