---
priority: P1
---
# 客户端工具执行添加 scanCode 安全扫描

客户端工具执行直接 `new Function()` 运行 handler 代码，完全跳过 `scanCode()` 安全扫描，可无限制访问浏览器 API，存在 XSS 和数据泄露风险。

> Anchor: `web/src/lib/tools/client-executor.ts:31`
