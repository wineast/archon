---
name: issue
description: 问题追踪管理。当用户说"记个 issue"、"这是个 bug"、"记录问题"、"创建 issue"等时调用。与 todo 不同，issue 有分析、涉及文件、修复方向。
allowed-tools: Read, Write, Edit, Glob, Bash, Grep
---

问题追踪技能——在 `issues/` 目录下维护问题列表。

## 定位：缺陷链路的种子（急诊初诊单）

Issue 是**记录层**——趁记忆热，~5 分钟内捕获发现者的第一手观察和直觉。不需要精确定位到文件行号（那是 `/diagnose` 的工作），只需要四个不可约元素：

- **Symptom**（看到了什么）：观察到的异常现象——够识别、够区分即可
- **Trigger**（怎么触发的）：当时在做什么、什么环境下——粗略即可
- **Locale**（大概在哪）：问题可能涉及的代码区域——页面级/功能级/文件路径均可
- **Hypothesis**（猜是什么原因）：基于当时上下文的因果推测——**可以是错的**

### 与 Todo 的区别

- **Issue**：缺陷种子——"有什么东西坏了"，需要捕获症状和触发条件，~5 分钟
- **Todo**：需求/优化种子——"要做一件事"，轻量记录，30 秒内完成

### 关于 Hypothesis

Hypothesis 是 issue 最有价值的部分之一。一个错误的假设比没有假设强十倍——它给后续诊断提供了**搜索方向**，哪怕方向错了也能加速排除。

写 Hypothesis 时：
- 可以猜原因、猜位置、猜修复方向
- 不确定就标注"不确定"，但不要留空
- 多个可能就都列出来

## 目录结构（扁平 + frontmatter 状态）

```
issues/
  {name}.md     ← 所有 issue 直接铺平在根目录
```

- 一个问题一个文件，所有 `.md` 文件直接放在 `issues/` 根目录
- **frontmatter `status` 字段是唯一状态源**，不再有子文件夹
- 状态变更 = 修改文件内 frontmatter 的 `status` 值（文件不移动）
- 有效状态值：`open`（待修复）、`ready`（就绪待派发）、`merged`（已合并，待归档）、`wontfix`（不修）

## Issue 文件规范

- 文件名格式：`{简短描述}.md`，用英文短横线连接
- ~5 分钟内完成，不需要精确到文件行号

### 模板

```markdown
---
priority: P1
status: open
tags: []
worktree:
---
# {一句话症状描述}

## Symptom（看到了什么）
{观察到的异常现象——够识别这个问题、区分于其他问题即可}

## Trigger（怎么触发的）
{当时在做什么操作、什么环境下——粗略即可，不需要精确复现步骤}

## Locale（大概在哪）
{问题可能涉及的代码区域——页面级 / 功能级 / 文件路径均可}

## Hypothesis（猜是什么原因）
{基于当时上下文的因果推测——可以猜原因、猜位置、猜修复方向，错了没关系}
```

### Frontmatter 字段

| 字段 | 说明 |
|------|------|
| `priority` | P0-P3，见下方定义 |
| `status` | 唯一状态源：`open` / `ready` / `merged` / `wontfix` |
| `tags` | 分类标签数组，如 `[auth]`、`[performance, db]`、`[ui, regression]`，便于按主题筛选 |
| `worktree` | 关联的工作区名称（如 `fix-auth`），未开工时留空 |

### Priority 定义

| 级别 | 含义 | 响应 |
|------|------|------|
| **P0** | 阻断核心流程，用户无法正常使用 | 立即修复 |
| **P1** | 功能异常但有绕行方案，或数据一致性风险 | 本迭代修复 |
| **P2** | 体验问题、边界 case、代码质量 | 排期修复 |
| **P3** | 轻微瑕疵、优化建议 | 有空再修 |

### 示例

```markdown
---
priority: P1
status: open
tags: [template, dataset]
worktree:
---
# 数据集预览在模板中渲染为空

## Symptom（看到了什么）
系统提示词模板中引用数据集变量 `{{ products[0].name }}`，预览面板显示为空字符串，但数据集编辑器里数据是有的。

## Trigger（怎么触发的）
在 Agent 构建页面编辑系统提示词，切换到 Preview tab 时发现。数据集刚创建不久，有 3 行数据。

## Locale（大概在哪）
模板预览相关——可能是 LiquidJS 渲染逻辑或数据注入环节。`web/src/components/template/` 一带。

## Hypothesis（猜是什么原因）
猜测是预览渲染时没有正确注入数据集数据。可能是数据集的 data 没传到 LiquidJS 的 context 里，或者传了但 key 对不上。
```

## 演化方向

Issue 不是终点，而是种子。根据 Symptom 和 Hypothesis 的性质，issue 有四种演化路径：

1. **→ 缺陷报告**：Symptom 是功能错误 + Hypothesis 指向代码缺陷 → `/diagnose` 深度诊断，输出 DEFECT.md
2. **→ 优化报告**：Symptom 是"太慢"/"太卡" → 可升级为性能优化任务
3. **→ 降级 Todo**：Symptom 是"不好用"但不是错 → 降级为 todo，走需求/优化链路
4. **→ 关闭**：调查后发现是预期行为或已修复 → 改为 `wontfix` 或删除文件

**衔接提示**：创建 issue 后，根据性质主动提示用户：
- "这个看起来是代码缺陷，要不要 `/diagnose` 深入排查？"
- "这个更像是体验优化而非 bug，要不要降级为 todo？"

### 元素对应关系（种子 → 报告）

```
Issue（种子）              缺陷报告（/diagnose）
─────────                  ────────────
Symptom  ──展开──→          Delta（印象 → 精确测量）
Trigger  ──展开──→          Path（故事 → 精确复现步骤）
Locale   ──展开──→          Location（搜索范围 → 精确代码坐标）
Hypothesis ──迁移──→        Root Cause（直觉 → 确认因果）
   ∅     ──新增──→          Impact（记录时没有 → 调查后补充）
```

## 操作流程

### 创建 Issue

1. 确保 `issues/` 目录存在
2. 按模板创建文件到 `issues/`（frontmatter `status: open`）
3. 确认：`已创建 issue — {Symptom 标题}`
4. 根据性质提示可能的演化方向

### 查看 Issue

列出 `issues/` 下所有 `.md` 文件，按 frontmatter `status` 筛选。

### 关闭 Issue

编辑文件 frontmatter，将 `status` 改为 `wontfix`（文件不移动）。

### 删除 Issue

直接删除文件。

## 注意事项

- 控制摩擦——~5 分钟内完成，不需要深入分析（那是 `/diagnose` 的工作）
- Hypothesis 不要留空——错了比没有强，标注不确定即可
- 四元素各司其职：Symptom 识别问题、Trigger 划定触发条件、Locale 缩小范围、Hypothesis 指引方向
- 文件名不带编号
- 状态完全由 frontmatter `status` 字段决定，文件不移动
- 创建工作区后，在 frontmatter 中填写 `worktree` 字段关联
