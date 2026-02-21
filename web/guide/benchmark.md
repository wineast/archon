# 基准测试（Benchmark）

Benchmark 模块在现有 Eval 系统之上提供分析层，支持趋势追踪、运行对比和跨模型分析。

## 概念

| 概念 | 说明 |
|------|------|
| **Baseline** | 基线运行，用于趋势图中的参考线和对比基准。每个 Agent 只允许一条基线 |
| **Trend** | 按时间排列的评测运行指标（分数、通过率、延迟） |
| **Compare** | 两次运行之间的逐用例对比 |
| **Model Stats** | 按模型聚合的性能统计 |

## 数据模型

### evalRuns 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| isBaseline | boolean | 是否为基线运行，默认 false |

同一 Agent 只允许一条 `isBaseline=true`，设置新基线时自动清除旧基线。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/eval/runs/[id]` | 设置/清除基线 `{ isBaseline: boolean }` |
| GET | `/api/eval/benchmark/trends?agentId=xxx` | 趋势数据（最近 50 次运行） |
| GET | `/api/eval/benchmark/compare?runA=xxx&runB=xxx` | 两次运行对比 |
| GET | `/api/eval/benchmark/models?agentId=xxx` | 跨模型统计 |

## UI

在 Eval 侧边栏底部点击 **Benchmark**（趋势图标）进入，包含三个子标签：

### Trends（趋势）
- 3 张折线图：分数趋势 (0-10)、通过率趋势 (0-100%)、延迟趋势 (ms)
- 基线运行以虚线标记
- 至少需要 2 次运行才能查看

### Compare（对比）
- 选择两次运行进行对比
- 汇总卡片显示分数、通过率、延迟的变化（绿涨红跌）
- 逐用例对比表格

### Models（模型）
- 按模型聚合的性能表格
- 包含运行次数、平均分、平均通过率、平均延迟、最后运行时间
- 最优模型行高亮

### 基线标记
- 在 Results 面板的运行历史中，每条记录有书签图标
- 点击可设为/取消基线
- 已标记的基线显示实心图标
