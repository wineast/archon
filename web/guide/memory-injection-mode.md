聊天时，系统会自动检索与当前用户相关的记忆，并注入到 AI 的上下文中。注入模式决定了记忆以什么方式传递给 AI。

## System Prompt

将记忆拼接到**系统提示词末尾**。AI 会把这些记忆视为自身指令的一部分，影响力最强。

```
[你的系统提示词内容]

<memories>
- [preference] (user, importance: 0.8) 用户偏好深色主题
- [fact] (global, importance: 0.6) 公司使用 React 技术栈
</memories>
```

**适用场景**：希望 AI 始终遵循记忆中的偏好和事实。

## Context

将记忆作为**独立的 system message**（`role: "system"`）插入消息列表开头，与系统提示词分离。

```
// 顶层 system 参数（不变）
system: "你是一个客服助手..."

// messages 数组
messages: [
  { role: "system", content: "<memories>..." },   ← 记忆在这里
  { role: "user", content: "帮我推荐个方案" }
]
```

与 System Prompt 模式的区别：System Prompt 把记忆直接拼进顶层 `system` 参数，Context 模式把记忆放在 `messages` 数组中作为独立消息。两者 AI 都能看到，但 Context 模式保持原始系统提示词不被修改。

> **关于兼容性**：不同模型厂商的 API 设计不同——OpenAI 在 messages 里支持 `role: "system"`，Anthropic (Claude) 则把 system 作为独立的顶层参数。Vercel AI SDK 客户端本身不做转换，它会把顶层 `system` 参数和 messages 里的 `role: "system"` 消息都原样发给 provider。真正抹平差异的是 **Vercel AI Gateway**（`gateway()`）——Gateway 服务端会根据目标模型的 API 格式做适配（例如将 messages 里的 system 消息合并到 Anthropic 的顶层 system 参数中）。Archon 使用 `gateway()` 调用模型，所以 Context 模式能正常工作。

**适用场景**：不希望记忆"污染"原始 prompt 模板，或需要更灵活地管理上下文。

## None

不注入任何记忆。记忆数据仍然保留，但聊天时不会传递给 AI。

**适用场景**：临时关闭注入用于调试，或仅将记忆作为数据存档。
