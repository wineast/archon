---
priority: P2
---
# 统一 API 错误响应格式

当前 API 路由存在三种错误响应格式：`{ error }`, `{ error, message }`, `{ ok: false, error }`。前端 error handling 需要兼容多种格式，增加复杂度。应统一为一种标准格式。

> Anchor: `web/src/app/api/` 下各 route.ts 的错误响应
