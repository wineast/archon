---
priority: P2
---
# 增强 MCP 运行时日志记录和展示

chat runtime 中 MCP 工具调用成功/失败都需记录 runtime event（mcp_tool_call），包含 serverKey、toolName、input、output、durationMs。同时 Runtime Events 面板需增加 MCP 相关事件的过滤和详情展示。

> Anchor: `web/src/lib/chat/runtime/`
