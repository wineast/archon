---
priority: P1
---
# 对上下文压缩和记忆提取的 AI 调用进行计量

上下文压缩和记忆提取调用 AI 模型但不计量 token 用量、不扣减积分，累积成本不可忽略。

> Anchor: `web/src/lib/chat/compress.ts:74-84`、`web/src/lib/memory/extract.ts:154-184`
