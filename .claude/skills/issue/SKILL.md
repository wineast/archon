---
name: issue
description: 问题追踪管理。当用户说"记个 issue"、"这是个 bug"、"记录问题"、"创建 issue"等时调用。与 todo 不同，issue 有分析、涉及文件、修复方向。
allowed-tools: Read, Write, Edit, Glob, Bash, Grep
---

问题追踪技能——在 `issue/` 目录下维护问题列表。

## 触发条件

当用户提到以下任意表述时，应调用此技能：
- "记个 issue"、"这是个 bug"、"记录问题"
- "创建 issue"、"提个 issue"
- "查看 issue"、"有哪些问题"
- "关闭 issue"、"这个修好了"
- "issue 列表"

## 与 Todo 的区别

- **Issue**：有分析、有涉及文件、有修复方向，适合 bug 和需要调研的问题
- **Todo**：一句话待办，快速记录，适合小任务、提醒、后续要做的事

## 目录结构（文件夹即状态）

```
issue/
  open/       ← 待修复
  closed/     ← 已关闭
```

- 一个问题一个文件，文件通过所在文件夹表示状态
- 状态变更 = 移动文件到对应文件夹

## Issue 文件规范

- 文件名格式：`{简短描述}.md`，用英文短横线连接
- 内容需要包含分析、涉及文件、修复方向

### 模板

```markdown
# {标题}

## 问题描述

{具体问题是什么}

## 涉及文件

- `path/to/file.ts` — {说明}

## 分析

{问题原因分析}

## 修复方向

{建议的修复方案}
```

## 操作流程

### 创建 Issue

1. 确保 `issue/open/` 目录存在
2. 创建文件到 `issue/open/`
3. 确认：`已创建 issue — {标题}`

### 查看 Issue

列出 `issue/open/` 下所有文件。

### 关闭 Issue

将文件从 `issue/open/` 移动到 `issue/closed/`：
```bash
mv issue/open/{name}.md issue/closed/
```

### 删除 Issue

直接删除文件。

## 注意事项

- Issue 需要有分析深度，不能只一句话
- 文件名不带编号
- 状态完全由文件夹决定
