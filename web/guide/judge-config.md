# Judge Config（评分维度配置）

Judge Config 定义 LLM 评审的评分维度，属于 Judge Agent（通过 evaluator 功能槽位引用的 Agent）。

## 概念

| 概念 | 说明 |
|------|------|
| **Judge Config** | 评分维度配置，包含名称和维度列表 |
| **Dimension** | 单个评分维度（如准确性、完整性），含 key/label/weight/min/max |
| **Active Config** | 当前激活的评分配置，同一 Agent 下只能有一个 |

## 与 Model Config 的关系

Judge Config **仅**存储评分维度，不包含模型/提示词/温度。评审模型配置复用 Judge Agent 自身的 Model Config。

评测运行时需要选择：
1. **被测 Agent 的 Model Config** — 对话模型
2. **Judge Agent 的 Model Config** — 评审模型
3. **Judge Agent 的 Judge Config** — 评分维度

## 数据库 Schema

### judgeConfigs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | uuid | 所属 Agent |
| versionId | uuid | 版本 ID |
| key | text | 唯一标识 |
| name | text | 配置名称 |
| isActive | boolean | 是否激活 |
| dimensions | jsonb | 评分维度列表 |

### Dimension 结构

```json
{
  "key": "accuracy",
  "label": "Accuracy",
  "weight": 0.5,
  "min": 0,
  "max": 10
}
```

| 字段 | 说明 | 默认值 |
|------|------|--------|
| key | 维度唯一标识 | — |
| label | 显示名称 | — |
| weight | 权重 | — |
| min | 最低分 | 0 |
| max | 最高分 | 10 |

权重（weight）用于计算加权平均分，所有维度权重之和应为 1.0。

min/max 支持自定义分数范围。常见配置：
- **标准评估**：min=0, max=10（默认，10 分制）
- **二元评估**：min=0, max=1（通过/不通过）

UI 中的分数显示会根据 max 值动态调整（如 `7/10` 或 `1/1`），无需额外配置。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/judge-configs?agentId=xxx` | 列出 Judge 配置 |
| POST | `/api/judge-configs` | 创建 Judge 配置 |
| PUT | `/api/judge-configs/[id]` | 更新 Judge 配置 |
| DELETE | `/api/judge-configs/[id]` | 软删除 |
| PUT | `/api/judge-configs/[id]/activate` | 激活/停用 |
| GET | `/api/judge-configs/active?agentId=xxx` | 获取当前激活的配置 |
| GET | `/api/judge-configs/by-agent?agentId=xxx` | 跨 Agent 查询配置 |

## UI

在 Agent Build 页面的 **Judge** Tab（锤子图标）中管理：

- 左侧：配置列表，显示名称和维度数量
- 右侧：配置详情编辑器
  - Key（只读）
  - Name
  - Dimensions 编辑器（key/label/weight/min/max 行列表，支持增删）
  - 底部操作栏：Active Switch / Save / Reset / Delete

底部区域显示评估记录聚合面板（当前 Agent 作为 Judge 的所有评测运行记录）。

## Fixture 种子数据

Evaluator Agent（`data/fixtures/evaluator/manifest.json`）预置以下 Judge Config：

| 配置 | 维度 | 分数范围 | 默认激活 |
|------|------|----------|----------|
| 二元评估 | pass (weight=1) | 0-1 | 是 |
| 通用评估 | accuracy/completeness/relevance/tone | 0-10 | 否 |
| 客服质量 | problem_resolution/empathy/clarity/proactiveness | 0-10 | 否 |
| 技术问答 | correctness/depth/practicality/code_quality | 0-10 | 否 |

## 版本系统

Judge Config 参与版本快照，快照字段：`key`、`name`、`isActive`、`dimensions`。

版本切换和导入/导出时会正确复制 Judge Config 数据。
