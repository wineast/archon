# 聊天界面支持 AI 输出可点击链接

系统提示词引导 AI 输出 `<a href="..." target="_blank">` 语法，聊天界面的 Markdown 渲染器需要支持将其渲染为真实可点击的超链接，支持 `target="_blank"` 新窗口打开等属性。

> Anchor: web/src/components/chat/ — 聊天消息渲染组件，需要查看当前 Markdown 渲染器对 HTML 标签的处理策略
