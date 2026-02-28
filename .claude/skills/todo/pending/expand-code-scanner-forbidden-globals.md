---
priority: P1
---
# 扩展 code-scanner 的 FORBIDDEN_GLOBALS 集合

当前 FORBIDDEN_GLOBALS 未覆盖 `fetch`、`XMLHttpRequest`、`WebSocket` 等危险全局变量，Tool Handler 可通过 `fetch()` 发起任意出站请求外泄数据。

> Anchor: `web/src/lib/code-scanner.ts`（FORBIDDEN_GLOBALS 定义）
