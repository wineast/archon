# 缺陷报告：工具/函数测试端点缺少授权检查 + Code Scanner 可被绕过

> 诊断时间：2026-03-01 21:00
> 环境：dev | API 层 | 分支 `dev-unauthenticated-code-execution-test-endpoints-20260301`

## 1. Delta（偏差）

### 期望行为（Should Be）
- `/api/tools/test` 和 `/api/functions/test` 应检查调用者拥有对应 Agent 的 `editor` 及以上角色，才允许执行测试代码
- `scanCode()` 在 acorn 解析失败时应拒绝代码（返回 `ok: false`），而非放行

### 实际行为（Is）
- 两个端点仅依赖 Clerk 认证（中间件 `auth.protect()`），**无资源级授权检查**——任何已登录用户均可提交并执行任意服务端代码
- `scanCode()` 在 `acorn.parse()` 抛异常时返回 `{ ok: true, errors: [] }`，完全跳过 AST 安全检查（禁止 `process`、`require`、`eval`、`new Function`、非 archon import 等规则全部失效）

### 偏差描述
测试端点缺少 Agent 角色授权 + Code Scanner parse 失败放行，组合后任何已认证用户可在服务端执行任意 JavaScript 代码，构成远程代码执行（RCE）漏洞。

## 2. Reproduction Path（复现路径）

### 环境与前置条件
- 系统：任意（API 层漏洞，不依赖浏览器）
- 数据依赖：仅需一个有效的 Clerk 认证 session
- 配置：无特殊配置要求

### 操作步骤

**路径 A：正常代码绕过授权**
1. 已登录用户发送 POST 请求到 `/api/tools/test`
2. Body: `{ "handler": "export default async function(args) { return 'pwned'; }", "args": {} }`
3. → 服务端直接执行代码并返回结果，无任何授权检查

**路径 B：利用 Scanner 绕过执行危险代码**
1. 已登录用户发送 POST 请求到 `/api/functions/test`
2. Body 中 `code` 字段包含故意触发 parse 失败的语法 + 危险操作（如 `process.env` 读取）
3. → `scanCode()` parse 失败返回 `ok: true`，跳过所有安全规则
4. → 代码被 `new Function()` 执行

### 复现证据

**证据 1：`/api/tools/test/route.ts` 无授权检查（第 5-27 行）**

对比同目录下 `/api/tools/route.ts` 有 `requireAgentRole(agentId, "editor")`，而 `test/route.ts` 仅做了 `handler` 参数非空校验后直接调用 `executeToolHandler()`。

**证据 2：`/api/functions/test/route.ts` 无授权检查（第 7-53 行）**

同样缺少 `requireAgentRole` 或 `requireAuth` 调用。

**证据 3：`code-scanner.ts` parse 失败放行（第 41-43 行）**

```typescript
} catch {
  // If acorn can't parse it, let it fail at execution time
  return { ok: true, errors: [] };
}
```

测试文件 `code-scanner.test.ts` 第 106-109 行明确确认此行为是"有意的"：
```typescript
it("passes code with syntax errors (defers to runtime)", () => {
  const result = scanCode(`export default function( { return 1; }`);
  expect(result.ok).toBe(true);
});
```

## 3. Location（定位）

### 功能模块
API 层 → 工具/函数测试端点 + 代码安全扫描器

### 代码定位

| 文件 | 行号 | 问题 |
|------|------|------|
| `web/src/app/api/tools/test/route.ts` | 5-27 | 缺少 `requireAgentRole` / `requireAuth` |
| `web/src/app/api/functions/test/route.ts` | 7-53 | 缺少 `requireAgentRole` / `requireAuth` |
| `web/src/lib/code-scanner.ts` | 41-43 | parse 失败返回 `ok: true` |
| `web/src/lib/code-scanner.test.ts` | 106-109 | 测试断言 parse 失败应返回 `ok: true`（需同步修改） |

### 根因分析

**根因 1：测试端点遗漏授权**

项目的授权模式是在路由 handler 内调用 `requireAgentRole(agentId, minRole)`。其他资源操作路由（如 `/api/tools/[id]/route.ts`、`/api/tools/route.ts`）均有此检查，但 `test/route.ts` 遗漏了——可能因为它不操作数据库资源，开发时认为"只是测试"而忽略了授权。

然而这两个端点接收 **任意用户代码** 并通过 `new AsyncFunction()` / `new Function()` 在服务端执行，实际危害远大于数据库 CRUD 操作。

**根因 2：Scanner 容错策略错误**

`scanCode()` 原设计意图是"parse 不了就让它在执行时自然报错"（注释：`let it fail at execution time`），但忽略了一个关键点：`transformToolHandlerImports()` 和 `transformFunctionModule()` 可能以不同方式解析代码，或者代码虽然 acorn parse 失败但 `new Function()` 仍可执行（因为 `new Function()` 不要求 ES module 语法）。

## 4. Impact（影响）

### 严重度
**阻断（Critical）** — 远程代码执行漏洞

### 影响范围
所有已认证用户（多租户场景下，任一租户的用户可攻击服务端）

### 影响描述
- **服务端 RCE**：攻击者可读取环境变量（数据库连接串、API keys）、读写文件系统、发起网络请求
- **数据泄露**：可访问其他租户数据（通过数据库连接）
- **服务中断**：可执行 `process.exit()` 等破坏性操作（scanner 绕过后）
- **横向移动**：获取的凭证可用于攻击其他服务

## 修复方向

### 问题 1：测试端点添加授权

两个 test 端点需要添加授权检查。由于 test 端点不关联特定 Agent（没有 `agentId`），有两个方案：

- **方案 A（推荐）**：要求请求体中传入 `agentId`，调用 `requireAgentRole(agentId, "editor")`——与其他路由一致，确保用户对目标 Agent 有编辑权限
- **方案 B**：仅验证认证（`requireAuth()`）——比现状好但仍允许任何登录用户执行代码

### 问题 2：Code Scanner parse 失败行为

- 将 parse 失败改为返回 `{ ok: false, errors: ["代码解析失败..."] }`
- 更新对应测试用例

### 最小改动
- `web/src/app/api/tools/test/route.ts` — 添加授权
- `web/src/app/api/functions/test/route.ts` — 添加授权
- `web/src/lib/code-scanner.ts` 第 41-43 行 — parse 失败返回 `ok: false`
- `web/src/lib/code-scanner.test.ts` — 更新测试断言

### 风险
- Scanner 改动可能影响正常代码的测试流程（如果用户代码确实有 syntax error），但这是正确行为——有语法错误的代码本就不应通过安全扫描
- 授权改动需前端配合传入 `agentId`

### 验收标准
1. Given 未登录用户, When POST `/api/tools/test`, Then 返回 401
2. Given 已登录但无 Agent 权限的用户, When POST `/api/tools/test` with `agentId`, Then 返回 403
3. Given 有 Agent editor 权限的用户, When POST `/api/tools/test` with valid `agentId`, Then 正常执行
4. Given 含语法错误的代码, When `scanCode()`, Then 返回 `ok: false`
5. 以上对 `/api/functions/test` 同理

## 过程备注

- [确认] Clerk 中间件对非公开 API 路由调用 `auth.protect()`，因此端点需要认证（已登录），但缺少资源级授权
- [确认] `/api/mcp-servers/[id]/test/route.ts` 已有 `requireAgentRole` 检查，与 tools/functions test 端点形成对比
- [确认] Scanner parse 失败行为在测试中被明确标注为"有意"（`defers to runtime`），需同步修改测试
