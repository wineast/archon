# 函数（Functions）模块

函数是服务端可复用的 JavaScript 代码单元，可被工具 Handler 或其他函数调用。

## 概念

| 概念 | 说明 |
|------|------|
| **Function** | 一段可复用的 JavaScript 代码，有输入输出定义 |
| **Builtin Function** | 系统内置函数，不可编辑但可直接使用 |
| **Dynamic Function** | 用户自定义函数，可编辑代码和参数 |

## 数据库 Schema

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| key | text | 函数唯一标识 |
| name | text | 函数名称 |
| description | text | 函数描述 |
| code | text | JavaScript 实现代码 |
| parametersSchemaId | uuid | 输入参数 Schema |
| returnParametersSchemaId | uuid | 返回值 Schema |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/functions?agentId=xxx` | 列出所有函数 |
| POST | `/api/functions` | 创建函数 |
| GET | `/api/functions/[id]` | 获取函数详情 |
| PATCH | `/api/functions/[id]` | 更新函数 |
| DELETE | `/api/functions/[id]` | 软删除函数 |

## UI

在 Agent Build 页面侧栏中点击 **Functions**（函数图标）进入：

- 左侧侧栏：内置函数 + 自定义函数列表
- 右侧详情：代码编辑器、参数 Schema 关联、测试用例
