---
priority: P2
---
# 全应用无速率限制——AI 聊天和代码执行端点可被滥用

## Symptom（看到了什么）
整个应用没有任何速率限制——搜索 rate/limit/throttle 无结果。关键攻击面：AI 聊天端点消耗昂贵 LLM token、代码执行端点、邀请码验证（可暴力破解）、Agent 导入（资源密集型 ZIP 处理）。

## Trigger（怎么触发的）
攻击者或恶意脚本高频请求 `/api/chat`、`/api/embed/chat`、`/api/tools/test`、`/api/invitation-codes/verify` 等。

## Locale（大概在哪）
全局——无中间件或包装器实现速率限制。影响最大的端点：`web/src/app/api/chat/route.ts`、`web/src/app/api/embed/chat/route.ts`、`web/src/app/api/tools/test/route.ts`

## Hypothesis（猜是什么原因）
需要引入速率限制中间件（如 `@upstash/ratelimit` + Redis），优先在 AI 聊天、代码执行、认证相关端点实施。
