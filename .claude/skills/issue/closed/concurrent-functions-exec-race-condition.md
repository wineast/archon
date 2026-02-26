# 并发工具调用导致 FunctionsExec 竞态条件 — "Exec context has been disposed"

## 问题描述

批量定价时，AI 并行调用 4 个定价工具（Ocean/Universe/Hermes/Radiant Portfolio），首次调用（冷缓存）3/4 失败，返回 `JS handler execution error: Exec context has been disposed`。仅最后完成编译的工具成功。第二次重试（热缓存）全部成功。

## 复现链接

https://archon-nu-brown.vercel.app/zh/49b15cf9/gmcc-advisor-2/v/0.1.0/chat?session=ac6a93b9-7d9b-4999-9341-bb35d81f41d5

## 涉及文件

- `web/src/lib/tools/tool-context.ts` — `getCompiledFunctions()` 缺少并发编译锁
- `web/src/lib/functions/compile.ts` — `setCachedFunctions()` 会 dispose 前一个 exec
- `web/src/lib/functions/exec.ts` — `FunctionsExec.call()` 在 disposed 后抛错
- `web/src/app/api/chat/tools/build-dynamic-tools.ts` — 每个工具独立创建 ToolContext

## 分析

### 触发路径 1（本次复现的根因）：并发编译竞态

`tool-context.ts` 的 `getCompiledFunctions()` 在缓存未命中时直接编译，没有对同一 agentId 的并发编译做去重。多个 ToolContext 并行触发编译后，`setCachedFunctions()` 会 dispose 前一个 exec context，导致仍在使用旧 exec 的工具抛错。

关键因果链（已逐点验证）：

1. `buildDynamicTools` 循环内为每个有 handler 的工具调用 `createToolContext()`（`build-dynamic-tools.ts:37`），每个工具获得独立 ToolContext 实例
2. 各实例的 `compiledFnsPromise` 是闭包局部变量（`tool-context.ts:109`），跨实例无去重
3. 4 个工具并行调用 `__context.fn()` → 都发现 `getCachedFunctions(agentId)` = miss → 都开始编译
4. 先完成的 `setCachedFunctions(agent, fns1, exec1)` 写入缓存
5. 后完成的 `setCachedFunctions(agent, fns2, exec2)` 调用 `prev.exec.dispose()`（`compile.ts:182-184`）销毁 exec1
6. 使用 fns1 的工具调用 `exec1.call()` → `disposed === true`（`exec.ts:223`）→ 报错

第二次重试全部成功的原因：上一轮最后一个 `setCachedFunctions` 留下了有效缓存，所有工具直接命中缓存，无编译、无 dispose。

### 触发路径 2（补充发现）：`clearFunctionCache` 跨请求 dispose

当用户在 chat 进行中（工具正在并行执行）通过另一个 tab 编辑/删除 function 时，API handler（如 `functions/[id]/route.ts:85`）调用 `clearFunctionCache(agentId)` → 立即 `exec.dispose()` + `agentCache.delete(agentId)` → 正在使用该 exec 的工具 handler 报错。

此路径不需要并发编译，单用户多 tab 即可触发。

### 触发路径总结

| 路径 | 触发条件 | 严重度 |
|------|----------|--------|
| 并发编译竞态 | 多工具并行调用 `__context.fn()`（冷缓存） | 高 — 多工具并行时必然发生 |
| `clearFunctionCache` | 用户在 chat 中编辑 function | 高 — 不需要并发，多 tab 即可 |
| `disposeTemplateData` | `after()` 调度 + skill 模板含 fn 标签 | 低 — 条件苛刻 |

## 修复方向

### 路径 1 修复：全局 agentId 级 Promise 锁

在 `tool-context.ts` 中为 `getCompiledFunctions()` 添加全局 Promise 去重，确保同一 agentId 的并发编译只执行一次：

```typescript
const compilingPromises = new Map<string, Promise<Map<string, unknown>>>();

async function getCompiledFunctions(): Promise<Map<string, unknown>> {
  const cached = getCachedFunctions(agentId);
  if (cached) return cached;

  const existing = compilingPromises.get(agentId);
  if (existing) return existing;

  const promise = doCompile();
  compilingPromises.set(agentId, promise);
  try {
    return await promise;
  } finally {
    compilingPromises.delete(agentId);
  }
}
```

### 路径 2 修复：`clearFunctionCache` 延迟 dispose

`clearFunctionCache` 不应立即 dispose exec，而应标记为 stale。可考虑引用计数或 copy-on-read 语义：每个消费者获取 cache entry 时增加引用计数，释放时减少，归零时才真正 dispose。
