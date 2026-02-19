---
name: issues
description: Issue 记录与管理。当用户说"开启 issue 记录模式"、"记录一下"、"这是个 bug"、"查看 issue"等时调用。记录模式下只记录不实现，结束后可基于 issue 创建工作区。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Issue 记录与管理技能——在 `issues/` 目录下记录项目问题，积累后批量创建工作区解决。

## 触发条件

当用户提到以下任意表述时，应调用此技能：
- "开启 issue 记录模式"、"记录模式"
- "记录一下"、"记个 issue"、"创建 issue"
- "这是个 bug"、"发现个问题"
- "查看 issue"、"有哪些 issue"
- "关闭 issue"、"这个修了"

## 目录结构（文件夹即状态）

```
issues/
  open/           ← 新发现、待处理
  in-progress/    ← 已分配工作区，开发中
  archived/       ← 已完成
```

- 文件通过所在文件夹表示状态，**文件内不写状态字段**
- 状态变更 = 移动文件到对应文件夹

## 核心工作流

```
用户："开启 issue 记录模式"
  ↓
记录模式（只记录，不实现）
  用户报告问题 → 创建 issue 文件到 issues/open/ → 简短确认 → 等待下一个
  ...
  ↓
用户："基于这些 issue 创建工作区"
  ↓
读取 issues/open/ 下所有 issue → 分组 → 调用 /worktree 创建工作区 → 移动到 issues/in-progress/
```

### 1. 记录模式

用户说"开启 issue 记录模式"后进入此模式：

- **只记录，不实现**：不要去修改任何业务代码，不要进入规划模式
- **快速响应**：每次用户报告问题时，快速分析 + 创建 issue 文件 + 简短确认
- **允许简要分析**：可以用 `Grep`/`Read` 快速查看相关代码以写出准确的分析，但不做任何修改
- **确认格式**：`已记录 — {标题}`（一行即可）

### 2. 创建工作区

用户说"基于这些 issue 创建工作区"时：

1. 读取 `issues/open/` 下所有 issue
2. 分析 issue 间的关联和依赖，合理分组
3. 向用户展示分组方案（哪些 issue 放在一个工作区）
4. 确认后，调用 `/worktree` 技能为每组创建工作区
5. 将对应 issue 文件移动到 `issues/in-progress/`，并在文件中添加 `- **工作区**: {name}` 字段

## Issue 文件规范

- 新建 issue 放入 `issues/open/`
- 文件名格式：`{简短描述}.md`（例：`build-assistant-no-default-model.md`），用英文短横线连接
- 创建前用 `Glob` 检查 `issues/` 下所有子目录是否已有同名文件，避免重复

### 模板

```markdown
# {标题}

- **优先级**: low | medium | high | critical
- **发现日期**: YYYY-MM-DD
- **工作区**: {worktree 名称，创建工作区时填入，新建 issue 时留空不写此行}

## 描述

{问题的详细描述}

## 分析

{技术分析、涉及的文件和代码位置、可能的原因}

## 修复方向

{建议的修复方案}
```

字段说明：
- 截图：如果用户提供了截图，在描述中注明"见对话中截图"
- 分析：引用具体文件路径和行号，尽量具体
- 修复方向：简要说明修复思路，不需要详细实现步骤
- 工作区：新建 issue 时不写此字段；分配工作区时添加，格式为工作区名称（如 `cleanup-dead-code`）

## 其他操作

### 查看 issue

列出 `issues/` 下各子目录的 issue，按状态分组展示。

### 关闭 issue

将文件从当前位置移动到 `issues/archived/`：
```bash
mv issues/in-progress/{name}.md issues/archived/
```

## 注意事项

- 记录模式下严禁修改业务代码
- 文件名不带编号，用简短英文描述命名
- 状态完全由文件夹决定，文件内无需状态字段
