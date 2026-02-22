# 会话（Sessions）模块

会话模块用于查看 Agent 的对话历史记录。

## 功能

- 查看自己的会话记录
- Admin 角色可切换查看所有用户的会话
- 选择会话后可查看完整对话消息
- 每条会话显示标题、消息数、创建时间

## 数据库 Schema

### chatSessions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| userId | uuid | 关联用户 |
| title | text | 会话标题 |
| model | text | 使用的模型 ID |
| messageCount | integer | 消息数 |
| metadata | jsonb | 自定义元数据 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions?agentId=xxx&all=true` | 列出会话（all=true 需 Admin） |
| GET | `/api/sessions/[id]/messages` | 获取会话消息 |

## 持久化时序

采用**分层持久化**策略，确保用户刷新页面时不丢失已发送的消息：

1. **Session 创建 + 用户消息**：在 `streamText()` 调用**之前** `await` 保存（~10-50ms），确保流式传输开始时数据库中已有记录
2. **AI 助手响应**：保留在 `onFinish → after()` 中异步保存，不阻塞流式响应

```
Request → await createSession + saveUserMessage → streamText → return → after() { saveAssistantMessage }
```

这意味着：
- 发送消息后立即刷新 → 能看到用户消息
- 流式回复中刷新 → 能看到用户消息（assistant 消息可能未保存）
- 流式完成后刷新 → 完整对话

此模式适用于所有三种聊天流：chat、build-chat、assist。

## 权限

- **Viewer**：查看自己的会话
- **Admin+**：查看所有用户的会话
