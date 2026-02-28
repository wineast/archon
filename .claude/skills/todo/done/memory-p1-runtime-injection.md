---
priority: P2
---
# 实现聊天时自动注入相关记忆

聊天时需自动把相关记忆注入 system prompt / context，根据 memoryConfig 的 injectionMode 和 maxInjectedMemories 配置控制注入行为。

> Anchor: `web/src/lib/chat/memory/`
