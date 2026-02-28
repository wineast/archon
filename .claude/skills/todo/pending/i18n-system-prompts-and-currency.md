---
priority: P2
---
# 系统提示词 + 计费界面本地化

UI 已 zh/en 双语，但深层内容未本地化：
1. Build Chat / Assist / Judge 系统提示词是英文，中文 FDE 看到英文指令
2. 用量面板只显示 USD，中国市场需要 CNY
3. 中文 locale 无默认中文模型推荐（Moonshot/Qwen）
4. guide 文档无中文镜像

> Anchor: `web/src/lib/build-chat/system-prompt.ts`, `web/src/components/usage/usage-panel.tsx`, `web/messages/`
