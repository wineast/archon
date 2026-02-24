# CaseDetail 单用例执行刷新后无法恢复进度

## 问题描述

CaseDetail 组件中单用例执行走同步 API 路径（POST `/api/eval/run/{runId}/case`），前端通过 `for` 循环 + `await delay(2000)` 轮询等待结果。刷新页面会中断轮询，导致用户无法看到正在执行的用例进度。

## 涉及文件

- `web/src/components/eval/case-detail.tsx` — 前端轮询逻辑（for 循环 × 120 次）
- `web/src/app/api/eval/run/[runId]/case/route.ts` — 单用例同步执行 API

## 分析

批量运行（Run All）通过 `after()` 异步执行 + SWR 轮询，刷新后能自动检测 running 状态恢复进度。但单用例执行是同步等待返回结果（通常几秒），不经过 `after()` 异步路径，因此刷新后前端轮询中断，无法恢复。

影响较小：单用例执行通常在几秒内完成，用户主动刷新的概率低。

## 修复方向

让单用例执行也走 `after()` 异步路径：
1. POST `/api/eval/run/{runId}/case` 改为立即返回，通过 `after()` 异步执行
2. 前端改用 SWR 轮询检测该用例结果是否出现在 `evalRunResults` 中
3. 需要在 `evalRunResults` 中增加状态标识区分"执行中"和"已完成"

权衡：复杂度较高，当前收益不大，可在用户反馈后再考虑。
