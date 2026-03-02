---
name: todo
description: 待办事项管理。当用户说"记个待办"、"TODO"、"以后再做"、"先记下来"等时调用。与 issue 不同，todo 是轻量级的任务备忘。
allowed-tools: Read, Write, Edit, Glob, Bash
---

待办事项管理技能——在 `todo/` 目录下维护待办列表。

## 定位：需求/优化链路的种子

Todo 是**记录层**——趁脑子里还有印象，30 秒内把一件事记下来。不需要分析，不需要方案，只需要三个不可约元素：

- **Intent**（做什么）：一句祈使句，足以让未来的自己知道该干嘛
- **Context**（为什么记）：是什么让你觉得这件事需要做——触发源
- **Anchor**（从哪开始）：下次拿起这件事时，第一个该看的地方

### 与 Issue 的区别

- **Todo**：需求/优化种子——"要做一件事"，轻量记录，30 秒内完成
- **Issue**：缺陷种子——"有什么东西坏了"，需要捕获症状和触发条件，~5 分钟

## 目录结构（扁平 + frontmatter 状态）

```
todo/
  {name}.md     ← 所有待办直接铺平在根目录
```

- 一个待办一个文件，所有 `.md` 文件直接放在 `todo/` 根目录
- **frontmatter `status` 字段是唯一状态源**，不再有子文件夹
- 状态变更 = 修改文件内 frontmatter 的 `status` 值（文件不移动）
- 有效状态值：`pending`（当前要做）、`backlog`（不急）、`ready`（就绪待派发）、`merged`（已合并，待归档）、`cancelled`（已取消）

## 待办文件规范

- 文件名格式：`{简短描述}.md`，用英文短横线连接
- **30 秒内完成**，每个元素一两句话，不要求详细分析

### 模板

```markdown
---
priority: P2
status: pending
tags: []
worktree:
---
# {一句话祈使句——做什么}

{为什么记这个——是什么让你觉得这件事需要做？一两句话}

> Anchor: {从哪开始——文件路径 / 页面 / 关联人 / PR / 讨论}
```

### Frontmatter 字段

| 字段 | 说明 |
|------|------|
| `priority` | P0-P3，见下方定义 |
| `status` | 唯一状态源：`pending` / `backlog` / `ready` / `merged` / `cancelled` |
| `tags` | 分类标签数组，如 `[test]`、`[test, e2e]`、`[refactor, performance]`，便于按主题筛选 |
| `worktree` | 关联的工作区名称（如 `fix-auth`），未开工时留空 |

### 三要素详解

**Intent（标题）——"做什么"**

用祈使句描述要完成的事情。测试标准：一周后的你读到这句话，能否在 5 秒内知道要做什么。
- "优化性能" ← 太模糊，5 秒后还是懵
- "优化 Dashboard 页面首屏加载速度" ← 5 秒内清楚
- "Dashboard 页面首屏加载需从 3.2s 降到 1s，主要瓶颈在..." ← 过度展开，这是优化报告

**Context（正文）——"为什么记这个"**

回答一个问题："此刻是什么让我觉得这件事需要做？"**一句话，不超过两句。** 够还原触发场景即可。
- "客户反馈数据太多找不到目标"
- "代码审查时发现这个模块耦合度太高"
- "部署后发现日志刷得太快"

没有 Context 的 todo 在优先级排序时变成黑箱——你无法判断它相对于其他 todo 有多重要。

**Anchor（锚点）——"从哪里开始"**

Anchor 是地址，不是文档。告诉未来的你去哪里找更多信息：
- 文件路径：`src/services/UserService.ts`
- 页面路径：`/dashboard`
- 关联人 / PR / 讨论

没有 Anchor 的 todo，Intent 和 Context 都有了，但坐到电脑前不知道从哪下手。

### 反模式（必须避免）

```markdown
# ❌ 错误：Context 变成需求文档
当前只有聊天界面和 embed widget，缺少 API 调用方式。企业需要：
1. Agent 发布后自动生成 REST API
2. 支持流式和非流式两种调用模式
3. API Key 认证
4. SDK（Python/Node.js）方便企业集成
→ 这不是 todo，这是需求报告。编号列表、方案细节、技术规格都不属于 Context。

# ✅ 正确：Context 只留触发源
企业客户需要编程式调用 Agent，当前只有聊天界面和 embed widget 两种方式。
```

**核心判断**：如果你写的 Context 超过两句话，或者出现了编号列表——停下来，你正在写报告，不是记 todo。把详细内容留给 `/requirement` 展开。

### Priority 定义

| 级别 | 含义 | 响应 |
|------|------|------|
| **P0** | 阻断核心流程或上线 | 立即做 |
| **P1** | 影响开发效率或质量，本迭代应完成 | 本迭代做 |
| **P2** | 有价值的改进，排期做 | 排期做 |
| **P3** | 锦上添花、长远优化 | 有空做 |

### 示例

```markdown
---
priority: P2
status: pending
tags: [ui]
worktree:
---
# 给 Dataset 编辑器加行号显示

用户反馈大数据集编辑时找不到位置，数据集超过 50 行后纯靠滚动效率很低。

> Anchor: `web/src/components/dataset/dataset-editor.tsx`
```

## 演化方向

Todo 不是终点，而是种子。根据 Context 的性质，todo 有四种演化路径：

1. **→ 需求报告**：Context 涉及新功能/新能力 → `/clarify-req` 澄清需求，输出 REQ.md
2. **→ 优化报告**：Context 涉及性能/体验改善 → 可升级为优化任务
3. **→ 直接完成**：改个文案、调个样式 → 直接动手，完成后删除文件
4. **→ 废弃**：想清楚后发现不需要做 → 删除文件

**衔接提示**：创建 todo 后，如果 Context 明显指向某条链路，主动提示用户：
- "这个看起来是新功能需求，要不要 `/clarify-req` 展开？"
- "这个改动比较小，可以直接开工。"

## 操作流程

### 添加待办

1. 确保 `todo/` 目录存在
2. 按模板创建文件到 `todo/`（frontmatter `status: pending`）
3. 确认：`已添加待办 — {Intent}`
4. 根据 Context 性质，提示可能的演化方向

### 查看待办

列出 `todo/` 下所有 `.md` 文件，按 frontmatter `status` 筛选。

### 暂缓待办

编辑文件 frontmatter，将 `status` 改为 `backlog`（文件不移动）。

### 激活待办

编辑文件 frontmatter，将 `status` 改为 `pending`（文件不移动）。

### 删除待办

直接删除文件。

## 注意事项

- 保持轻量——30 秒内完成，不要在 todo 阶段做分析
- 三元素缺一不可：Intent 让未来知道干什么，Context 让未来知道为什么，Anchor 让未来知道从哪开始
- 文件名不带编号
- 状态完全由 frontmatter `status` 字段决定，文件不移动
- 创建工作区后，在 frontmatter 中填写 `worktree` 字段关联
