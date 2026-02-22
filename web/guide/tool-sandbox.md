# 工具沙盒执行

## 概述

替代 `new Function()` 裸执行，按工具复杂度分两层隔离：

| 层级 | 技术 | 适用场景 | 延迟 | 成本 |
|------|------|---------|------|------|
| 轻量（默认） | quickjs-emscripten (asyncify) | 纯逻辑 + ToolContext 调用 | <10ms | 0 |
| 完整 | Vercel Sandbox (Firecracker) | npm 包 / HTTP 请求 / 复杂逻辑 | ~150ms | $0.128/CPU·h |

## 当前问题

5 处使用 `new Function("return (" + handler + ")")()` 执行用户代码：

| 文件 | 场景 |
|------|------|
| `lib/chat/tools/build-dynamic-tools.ts` | 聊天时 server 工具执行 |
| `api/tools/test/route.ts` | 工具快速测试 |
| `api/tools/[id]/test-cases/run/route.ts` | 测试用例运行 |
| `api/tools/[id]/test-runs/[runId]/case/route.ts` | 批量测试单用例 |
| `lib/tools/client-executor.ts` | 浏览器端执行（风险较低） |

handler 代码可访问 Node.js 全局对象（`process`、`fetch`、环境变量），无内存/CPU 限制。

## 数据模型

### tools 表变更

新增 `sandboxMode` 字段：

```
sandboxMode TEXT NOT NULL DEFAULT 'light'  -- 'light' | 'full'
```

- `light`：QuickJS WASM 进程内沙盒（默认）
- `full`：Vercel Sandbox 微虚拟机

仅当 `executionTarget = 'server'` 且 handler 为 JS 代码时生效。URL handler 和 client/host 不受影响。

## P1：QuickJS 轻量沙盒

### 架构

复用现有 `lib/functions/sandbox.ts` 的 QuickJS 封装，扩展 async 支持：

```
tool handler 代码
  → QuickJS WASM VM (asyncify 构建)
  → ToolContext 方法作为宿主回调注入
  → 内存 128MB / 超时 5s / 无 Node.js API
```

### 需要改造的模块

#### 1. 新建 `lib/tools/sandbox.ts`

基于 `lib/functions/sandbox.ts`，扩展为支持 async 的工具沙盒：

```typescript
import { newAsyncContext } from 'quickjs-emscripten'

export async function executeToolInSandbox(
  handlerCode: string,
  args: unknown,
  context: ToolContext,
): Promise<unknown> {
  const ctx = await newAsyncContext()

  // 注入 ToolContext 为宿主回调
  // context.wiki.get() → 沙盒内 context.wiki.get()
  // context.dataset.get() → 沙盒内 context.dataset.get()
  // context.fn() → 沙盒内 context.fn()
  // context.ontology.* → 沙盒内 context.ontology.*

  // 执行 handler（ES module 格式，经过 import 变换后执行）
  const result = await ctx.evalCodeAsync(transformedCode)

  return result
}
```

关键点：
- 使用 `@jitl/quickjs-wasmfile-release-asyncify` 变体（支持 async 宿主回调）
- ToolContext 的每个异步方法注册为宿主函数，沙盒内 `await` 时挂起 WASM → 宿主侧执行真正的 DB 查询 → 恢复 WASM
- asyncify 有「单次挂起」限制 — 不能同时 await 多个宿主回调，需串行化

#### 2. 替换所有 `new Function()` 调用

| 原始位置 | 改为 |
|----------|------|
| `build-dynamic-tools.ts` resolveExecutor | `executeToolInSandbox(handler, args, context)` |
| `api/tools/test/route.ts` | 同上 |
| `api/tools/[id]/test-cases/run/route.ts` | 同上 |
| `api/tools/[id]/test-runs/[runId]/case/route.ts` | 同上 |

`client-executor.ts`（浏览器端）暂不改动 — 浏览器本身是沙盒，风险较低。

#### 3. 依赖安装

```bash
npm install @jitl/quickjs-wasmfile-release-asyncify
```

检查现有 `quickjs-emscripten` 依赖版本，确认 asyncify 变体兼容。

### 测试要点

- 纯同步 handler：`export default function(args) { return { result: args.x * 2 }; }`
- wiki 调用：`import { wiki } from "archon:context"; export default async function(args) { return { doc: await wiki.get(args.id) }; }`
- dataset 调用：`import { dataset } from "archon:context"; export default async function(args) { return { data: await dataset.get(args.key) }; }`
- fn 调用：`import { fn } from "archon:context"; export default async function(args) { const myFn = await fn('myFn'); return { val: myFn(args) }; }`
- ontology 调用：`import { ontology } from "archon:context"; export default async function(args) { return { items: await ontology.query(args.type) }; }`
- 超时测试：`export default function() { while(true){} }` → 应在 5s 内终止
- 非法访问：`export default function() { return process.env; }` → 应报错（process 未定义）
- 非法访问：`export default function() { return fetch('https://evil.com'); }` → 应报错（fetch 未定义）
- 旧格式拒绝：`(args) => args` → 应抛出 SandboxError

## P2：Vercel Sandbox 重型沙盒

### 架构

```
tool handler 代码
  → @vercel/sandbox API
  → Firecracker 微虚拟机 (Node.js 24)
  → 完整 Node.js 环境 + npm
  → 内存 2GB / 超时 45min
```

### 新建 `lib/tools/sandbox-full.ts`

```typescript
import { Sandbox } from '@vercel/sandbox'

export async function executeToolInFullSandbox(
  handlerCode: string,
  args: unknown,
  contextData: SerializedToolContext,  // 预序列化的上下文数据
): Promise<unknown> {
  const sandbox = await Sandbox.create({ runtime: 'node24' })

  // 写入 handler 脚本
  await sandbox.writeFile('handler.js', `
    const handler = ${handlerCode};
    const args = ${JSON.stringify(args)};
    const context = ${JSON.stringify(contextData)};

    async function main() {
      const result = await handler(args, context);
      process.stdout.write(JSON.stringify(result));
    }
    main().catch(e => {
      process.stderr.write(e.message);
      process.exit(1);
    });
  `)

  const result = await sandbox.exec('node handler.js')
  await sandbox.destroy()

  return JSON.parse(result.stdout)
}
```

注意：Vercel Sandbox 是独立虚拟机，ToolContext 无法作为回调注入。需要**预取上下文数据**序列化传入，或在虚拟机内通过 HTTP 回调主服务。

### 依赖安装

```bash
npm install @vercel/sandbox
```

## P3：UX 设计

### 工具表单变更

当 `executionTarget === 'server'` 且 `handlerMode === 'code'` 时，在 Handler 编辑器下方新增「运行时」选择器：

```
┌─────────────────────────────────────────────────────┐
│ 执行环境    [服务端]  [浏览器]  [宿主]               │
├─────────────────────────────────────────────────────┤
│ Handler     [简单]  [代码]                           │
│ ┌─────────────────────────────────────────────────┐ │
│ │ import { dataset } from "archon:context";        │ │
│ │                                                 │ │
│ │ export default async function(args) {           │ │
│ │   const data = await dataset.get('...')         │ │
│ │   return { result: data }                       │ │
│ │ }                                               │ │
│ └─────────────────────────────────────────────────┘ │
│ 💡 JS 代码 — 在安全沙盒中执行                        │
│                                                     │
│ 运行时      [轻量]  [完整]                           │
│                                                     │
│ 轻量模式（选中时显示）：                               │
│ ℹ️ 纯 JS 逻辑 + Context API，进程内沙盒，延迟 <10ms  │
│                                                     │
│ 完整模式（选中时显示）：                               │
│ ℹ️ 完整 Node.js 环境，支持 npm 包和 HTTP 请求，       │
│    Firecracker 微虚拟机隔离，冷启动约 150ms           │
└─────────────────────────────────────────────────────┘
```

### 运行时切换规则

| executionTarget | handlerMode | 显示运行时选择器 |
|----------------|-------------|---------------|
| server | code | ✅ 显示 |
| server | simple (URL) | ❌ 不显示（URL handler 直接 HTTP POST） |
| client | * | ❌ 不显示（浏览器端执行） |
| host | * | ❌ 不显示（宿主端执行） |

### Playground 增强

在 Playground 的执行结果区域增加标签：

```
┌──────────────────────────────────────────┐
│ 输出                                      │
│ ┌──────────────────────────────────────┐ │
│ │ { "result": "..." }                  │ │
│ └──────────────────────────────────────┘ │
│ 🏷️ 轻量沙盒 · 8ms                       │
│    或                                    │
│ 🏷️ 完整沙盒 · 312ms (含冷启动 148ms)     │
└──────────────────────────────────────────┘
```

### 提示文案变更

当前 handler 代码模式的提示是：
> 💡 JS 代码 — 运行时动态执行

改为：
> 💡 JS 代码 — 在安全沙盒中执行

### Context API 提示完善

当前只提示了 wiki API，补全所有可用 API：

```
可用 Context API：
• context.wiki.get(key) / findByPrefix(prefix) / search(query)
• context.dataset.get(key) / getEntries(key)
• context.fn(key) — 调用 Functions 中定义的函数
• context.ontology.query(typeKey) / get(typeKey, id) / create(...) / update(...) / delete(...)
```

完整模式额外可用：
```
• require() — 引入 npm 包（需在 handler 内 require）
• fetch() — 发起 HTTP 请求
• 完整 Node.js API
```
