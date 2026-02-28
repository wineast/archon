---
priority: P2
---
# 为 AI 辅助编辑注入系统提示词和 builtin wiki 上下文

AI 辅助编辑缺少系统提示词和参考文档。需要创建 builtin wiki 文档（内容来自 guide 目录），增加字段上下文系统变量（如当前编辑的是 modelConfig 的系统提示词），并根据字段动态获取对应的 builtin wiki 作为 AI 编辑参考。

> Anchor: `web/src/components/ai-edit/`
