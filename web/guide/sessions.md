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

## 权限

- **Viewer**：查看自己的会话
- **Admin+**：查看所有用户的会话
