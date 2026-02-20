# 评测（Eval）模块

评测模块用于系统化测试 Agent 的回复质量，支持断言验证和 LLM 评审两种评估方式。

## 概念

| 概念 | 说明 |
|------|------|
| **Eval Case** | 测试用例，定义输入 + 预期输出 + 断言规则 |
| **Judge Config** | 评审配置，定义 LLM 评审的模型、提示词、评分维度 |
| **Eval Run** | 一次评测运行，包含多个用例的执行结果 |
| **Assertion** | 断言规则（如包含关键词、正则匹配等），用于自动判定通过/失败 |
| **Dimension** | 评审维度（如准确性、相关性），由 Judge LLM 打分 |

## 测试用例模式

| 模式 | 说明 |
|------|------|
| **single** | 单轮对话：一问一答 |
| **multi** | 多轮对话：多个 turn 按顺序执行 |

## 数据库 Schema

### evalCases 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 关联 Agent |
| key | text | 用例唯一标识 |
| name | text | 用例名称 |
| mode | text | `single` / `multi` |
| turns | jsonb | 对话轮次 |
| expectedOutput | text | 预期输出 |
| assertions | jsonb | 断言规则列表 |
| tags | text[] | 标签（用于筛选） |

### evalJudgeConfigs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| model | text | 评审模型 |
| systemPrompt | text | 评审系统提示词 |
| temperature | real | 温度 |
| dimensions | jsonb | 评审维度列表 |
| isDefault | boolean | 是否默认配置 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/eval/cases?agentId=xxx` | 列出测试用例 |
| POST | `/api/eval/cases` | 创建用例 |
| PATCH | `/api/eval/cases/[id]` | 更新用例 |
| DELETE | `/api/eval/cases/[id]` | 删除用例 |
| POST | `/api/eval/run` | 启动评测运行 |
| GET | `/api/eval/runs?agentId=xxx` | 列出运行记录 |

## UI

在 Agent Build 页面侧栏中点击 **Evaluate**（烧瓶图标）进入：

- **Cases**：管理测试用例，支持 tag 筛选
- **Judge**：配置评审模型和评分维度
- **Results**：查看评测运行结果，含断言通过率和维度评分
