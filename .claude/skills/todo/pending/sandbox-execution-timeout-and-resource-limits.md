---
priority: P1
---
# 给 Function/Tool 执行添加超时和资源限制

当前用户代码通过 `new Function()` 在主进程中执行，无 CPU/内存限制，恶意代码可阻塞整个服务器。

> Anchor: `web/src/lib/functions/exec.ts`、`web/src/lib/tools/execute-handler.ts`
