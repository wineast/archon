---
priority: P1
---
# Agent 业务 KPI 仪表盘（超越 token 计量）

当前只有 token 用量统计。FDE 需要向企业客户证明 ROI 的业务指标：
- 用户参与度：日活会话数、平均会话时长、留存率
- Agent 效果：任务完成率、用户满意度、错误率
- 成本效率：每会话/每任务成本
- 工具健康度：哪些工具失败率最高
- 对比视图：新版本 vs 旧版本指标对比

竞品 Voiceflow/Botpress 都有 analytics dashboard。"用了 10M token" 不卖货，"支持队列减少 30%" 才卖。

> Anchor: `web/src/components/usage/usage-panel.tsx`, `web/src/lib/usage/hooks.ts`
