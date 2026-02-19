# Agent 运行监控系统

- **优先级**: high
- **发现日期**: 2026-02-19
- **工作区**: agent-monitoring

## 描述

当前平台有三个"类监控"模块，但各自只覆盖一个切面，拼不出完整的运行监控：

1. **UsagePanel**（`web/src/components/usage/usage-panel.tsx`）— 只能看"量"（费用、token），看不到"异常"
2. **AuditLog**（`web/src/components/audit-log/audit-log-sheet.tsx`）— 只记录配置变更（CRUD），不记录运行时事件
3. **EvalRuns**（`evalRuns` + `evalRunResults` 表）— 手动触发的测试，不是持续监控

最大空白：FDA 部署完 Agent 后，无法知道它跑得好不好、有没有报错、用户满不满意。对 to B 场景，这是企业客户最在意的东西。

## 分析

- 用量数据采集已有完整埋点（`web/src/lib/usage/record.ts`），覆盖 chat / embed / prompt-assist / eval 四个来源
- `usageRecords` 表（`web/src/db/schema.ts:1094`）记录了 token 和费用，但没有延迟、错误、工具执行结果等运行时指标
- `auditLogs` 表（`web/src/db/schema.ts:1161`）只记录资源 CRUD，不记录运行时事件
- `execute-stream.ts`（`web/src/lib/chat/execute-stream.ts`）是核心执行入口，错误直接抛出未持久化
- 组织级用量 Dashboard 已有（`web/src/components/orgs/org-usage-panel.tsx`），可作为监控 Dashboard 的基础扩展

## 修复方向

### P1：运行时事件采集
- 新增 `runtimeEvents` 表（agentId, sessionId, eventType, severity, metadata, durationMs, createdAt）
- eventType 枚举：llm_error, tool_error, tool_timeout, stream_error, rate_limit 等
- 在 execute-stream 中埋点：LLM 调用延迟、工具执行成功/失败/耗时、流式响应错误
- 用 `after()` 非阻塞写入，不影响流式响应

### P2：Agent 健康度仪表盘
- 组织级和 Agent 级两个维度
- 概览卡片：成功率、平均延迟、错误数、活跃会话数
- 时序图：请求量趋势、错误率趋势、延迟 P50/P95/P99
- 错误列表：最近错误详情，可展开查看 stack trace / 工具入参
- 整合现有 UsagePanel 的费用数据

### P3：告警系统
- 可配置告警规则：错误率 > X%、延迟 > Xms、费用 > $X/天
- 告警通知渠道：平台内通知、Webhook（企业微信/钉钉/Slack）
- 告警历史记录与静默规则

### P4：会话质量分析
- 用户满意度采集（对话结束后评分）
- 对话完成率（用户是否得到了想要的答案）
- 热点问题统计（高频 query 聚类）
- 与 EvalRuns 集成：定时自动评估，检测质量漂移
