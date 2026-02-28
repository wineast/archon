---
priority: P0
---
# 工具/函数测试端点缺少授权检查可执行任意服务端代码

## Symptom（看到了什么）
`/api/tools/test` 和 `/api/functions/test` 接受请求体中的代码字符串（handler / code），通过 `new Function()` 在服务器端执行，但没有任何资源级授权检查——任何已认证用户可执行任意服务端代码。

## Trigger（怎么触发的）
已认证用户发送 POST 请求到 `/api/tools/test`，body 中传入任意 JavaScript 代码。

## Locale（大概在哪）
`web/src/app/api/tools/test/route.ts`（1-27 行）、`web/src/app/api/functions/test/route.ts`（1-53 行）

## Hypothesis（猜是什么原因）
这两个路由缺少 `requireAgentRole` 或类似授权检查。加上 code-scanner 在 parse 失败时返回 `ok: true`（`code-scanner.ts:41-44`），恶意代码可绕过扫描直接执行。需要添加授权检查，并修复 scanner 的 parse failure 行为。
