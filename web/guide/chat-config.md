# 对话配置（Chat Config）

对话配置控制 Agent 聊天界面的外观和交互体验，每个 Agent 有且仅有一份配置（1:1）。

## 可配置项

| 字段 | 说明 |
|------|------|
| **Title** | 聊天界面标题 |
| **Welcome Title** | 欢迎区域标题文案 |
| **Welcome Icon** | 欢迎区域图标 |
| **Placeholder** | 输入框占位文案 |
| **Quick Actions** | 快捷操作按钮列表 |
| **Suggestions** | 建议话题列表，显示在欢迎区域 |
| **Voice Input** | 是否启用语音输入（默认关闭） |
| **Attachment Upload** | 是否启用附件上传（默认关闭） |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat-configs?agentId=xxx` | 获取对话配置 |
| POST | `/api/chat-configs/[id]` | 更新对话配置 |

## Build Chat 工具

| 工具 | 说明 |
|------|------|
| `get_chat_config` | 获取当前对话配置 |
| `update_chat_config` | 更新对话配置 |
