# GET /api/eval/runs 超时清理副作用

## 问题描述

GET `/api/eval/runs` 在返回列表时，会对超过 30 分钟仍为 `running` 状态的 run 自动标记为 `failed`。这是一个读请求中的写操作（side effect in GET），不符合 REST 规范，且高并发下可能有竞态问题。

## 涉及文件

- `web/src/app/api/eval/runs/route.ts` — GET handler 中的超时清理逻辑

## 分析

当前实现将超时清理嵌入 GET 请求中，作为"懒清理"策略。好处是无需额外定时任务；问题是：
1. GET 请求不应有写副作用（REST 语义）
2. 多个并发 GET 请求可能同时触发清理，虽然 SQL UPDATE 本身是幂等的，但增加了不必要的写操作
3. 如果没有人查看 runs 列表，超时 run 永远不会被清理

## 修复方向

方案 A：在执行引擎侧处理超时——`executeEvalRun` 中设置整体超时（如 `setTimeout`），超时后主动标记 `failed`。但 `after()` 的生命周期受 Next.js 控制，不一定可靠。

方案 B：抽成独立的清理函数，在 POST 创建 run 时顺带清理旧的超时 run（写请求中的写操作更合理）。

方案 C：保持现状但加注释说明——当前阶段并发量低，实际影响可忽略。

建议先用方案 B，将清理逻辑从 GET 移到 POST `/api/eval/run`（创建新 run 时顺便清理）。
