---
priority: P1
---
# 积分余额可变为负数——无下限约束且检查非原子

## Symptom（看到了什么）
积分余额可以变为负数——数据库 `credit_balance_usd` 列没有 `CHECK >= 0` 约束，应用层的 `ensureCredits()` 检查使用 60 秒缓存且与扣减不原子。10 个并发请求各看到 $0.50 余额（来自缓存），全部通过检查，各扣 $0.10，最终余额 -$0.50。

## Trigger（怎么触发的）
多个并发聊天请求同时通过 `ensureCredits()` 的缓存检查后各自执行 AI 调用并扣减积分。

## Locale（大概在哪）
`web/src/lib/usage/record.ts`（71-76 行，无 floor 的 SQL 扣减）、`web/src/lib/credits/queries.ts`（17-31 行，60s TTL 缓存）、`web/src/lib/ai/resolve-model.ts`（128-133 行，ensureCredits 检查）

## Hypothesis（猜是什么原因）
两种修复方案：(1) 数据库层加 `CHECK (credit_balance_usd >= 0)` 约束；(2) 将检查和扣减合并为原子操作 `UPDATE orgs SET credit_balance_usd = credit_balance_usd - cost WHERE credit_balance_usd >= cost`，通过 affected rows 判断是否成功。
