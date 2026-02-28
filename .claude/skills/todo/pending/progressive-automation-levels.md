---
priority: P2
---
# 实现渐进式自动化级别（L1/L2/L3）

参考 Relevance AI 的模式，让企业客户逐步提升 Agent 自主度：
- L1 辅助：FDE 驱动，AI 辅助（人主导，AI 建议）
- L2 协作：AI 驱动，FDE 监督（AI 主导，关键节点人工确认）
- L3 自主：全自动（审计日志 + 异常告警）

匹配企业采用曲线——从低信任开始，随着效果验证逐步放权。Dify 已有 Human-in-the-Loop 节点。

> Anchor: 需新建概念设计，参考 `web/guide/` 现有文档
