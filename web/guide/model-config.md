# 模型配置（Model Config）

模型配置模块允许为 Agent 创建多套 LLM 配置，支持在不同配置间切换。

## 概念

| 概念 | 说明 |
|------|------|
| **Model Config** | 一套模型配置，包含模型 ID、系统提示词、温度 |
| **Active Config** | 当前激活的配置，Agent 运行时使用此配置 |

## 数据库 Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| key | text | 配置唯一标识 |
| name | text | 配置名称 |
| modelId | text | 模型 ID（如 `anthropic/claude-opus-4`） |
| systemPrompt | text | 系统提示词 |
| temperature | real | 温度（默认 0.7） |
| isActive | boolean | 是否为当前激活配置 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/model-configs?agentId=xxx` | 列出所有配置 |
| POST | `/api/model-configs` | 创建配置 |
| PATCH | `/api/model-configs/[id]` | 更新配置 |
| DELETE | `/api/model-configs/[id]` | 删除配置 |
| GET | `/api/model-configs/active?agentId=xxx` | 获取激活配置 |
| POST | `/api/model-configs/[id]/activate` | 激活指定配置 |

## UI

在 Agent Build 页面侧栏中点击 **Model Config**（设置图标）进入：

- 左侧侧栏：配置列表（激活项显示绿色标记）
- 右侧详情：编辑模型 ID、系统提示词、温度，支持激活/删除
