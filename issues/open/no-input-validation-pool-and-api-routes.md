---
priority: P2
---
# API 路由缺少输入验证——请求体直接传入数据库操作

## Symptom（看到了什么）
绝大部分 API 路由不使用 Zod 或任何运行时 schema 验证，直接从 `req.json()` 解构并传入数据库操作。Pool 资源的 POST/PATCH 尤其严重——body 直接传入 `db.insert/update`，无字段白名单。

## Trigger（怎么触发的）
发送包含非预期字段的请求体（如注入 `orgId`、`createdAt` 等不应由客户端控制的字段）。

## Locale（大概在哪）
`web/src/app/api/pool/[resourceType]/route.ts`（60-68 行 POST）、`web/src/app/api/pool/[resourceType]/[id]/route.ts`（40-46 行 PATCH）、以及大部分 CRUD API 路由

## Hypothesis（猜是什么原因）
为每个 API 路由定义 Zod schema 验证请求体，特别是 pool 路由需要白名单可修改字段。可创建通用的 `validateBody(schema)` 辅助函数统一使用。
