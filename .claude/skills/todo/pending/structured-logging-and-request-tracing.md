---
priority: P2
---
# 引入结构化日志和请求关联 ID

当前全部使用 `console.log/error` 无结构输出且绝大部分 API 路由零日志，无法追踪单个请求的完整调用链。

> Anchor: 全局——`web/src/app/api/` 下所有路由
