---
priority: P1
---
# 对话式 Agent 创建向导（Build Chat 上层体验）

Build Chat 基础设施完备（服务端工具、SWR 同步、资源摘要），但缺少 FDE 友好的引导层：
1. 首次创建引导："你的 Agent 主要做什么？" → "需要连接哪些数据源？" → AI 推荐初始配置
2. "建议配置"模式：FDE 用自然语言描述需求 → AI 生成工具/模型/RAG 配置方案 → 预览确认后一键应用
3. Build Chat 系统提示词本地化：当前英文技术语言，需改为面向业务人员的中文版

这是 CLAUDE.md 产品推论的核心——"对话式 Agent 配置体验"。

> Anchor: `web/src/lib/build-chat/system-prompt.ts`, `web/src/components/build-chat/build-chat-panel.tsx`
