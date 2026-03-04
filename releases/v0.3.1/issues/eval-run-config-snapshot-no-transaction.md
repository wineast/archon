---
priority: P0
status: merged
tags: [eval, config-consistency, db]
worktree: eval-run-config-snapshot-no-transaction
merged: true
---
# Eval Run 创建时三次配置查询非事务性，存在读取不一致窗口

## Symptom（看到了什么）
run 创建时 agent modelConfig、judge modelConfig、judgeConfig 三次 DB 查询是独立的 await，没有包在同一个数据库事务中。并发修改 judge agent 配置时可能快照到不一致的组合。

## Trigger（怎么触发的）
在发起 eval run 的同时，另一个操作修改了 judge agent 的 active modelConfig 或 judgeConfig（如从配置 A 切换到配置 B）。三次查询落在修改的前后，导致 judgeModelConfig 读到旧配置 A，judgeConfig 读到新配置 B。

## Locale（大概在哪）
- `web/src/app/api/eval/run/route.ts`（第 57-106 行）—— 三次独立 db.select()
- `web/src/app/api/eval/batch/route.ts`（第 61-110 行）—— 同样的问题

## Hypothesis（猜是什么原因）
三次查询之间没有事务隔离。虽然单用户场景下并发概率低，但 batch 模式或多人协作时风险增大。修复方向：将三次配置查询包在 `db.transaction()` 中，确保读取快照的原子性。

## Impact（不修会怎样）

用户在调整 Judge Agent 配置的同时发起 eval run，可能导致该次评估使用了"一半新、一半旧"的配置组合——评分结果既不代表旧配置也不代表新配置，用户看到的分数没有参考价值却无法察觉。尤其在多人协作或 batch 批量跑评估时，概率更高，且排查困难（快照已落库，看不出是混合读取的产物）。当前绕行方案：确保修改配置和发起 run 不同时操作，但这完全依赖人为自觉，不可靠。
