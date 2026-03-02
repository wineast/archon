---
name: commit
description: 提交代码。当用户说"提交"、"commit"、"提交代码"等时调用。分析暂存区变更，生成语义化 commit message 并提交。
allowed-tools: Bash, Read, Grep, Glob
---

提交当前工作区的暂存区变更。

## 工作流

### 1. 检查暂存区状态

```bash
git status -u
```

- 如果暂存区为空（无 staged changes），提示用户先 `git add`
- 如果有未暂存的变更，仅提交已暂存的部分

### 2. 分析变更内容

```bash
# 暂存区的 diff
git diff --cached --stat
git diff --cached
```

阅读 diff 内容，理解本次提交的变更范围和目的。

### 3. 生成 commit message

根据变更内容生成语义化 commit message：

**格式**：`<type>: <描述>`

**type 选择**：
- `feat` — 新功能
- `fix` — Bug 修复
- `refactor` — 重构（不改变行为）
- `chore` — 构建/工具/配置变更
- `docs` — 文档变更
- `test` — 测试变更
- `style` — 格式调整（不影响逻辑）

**描述**：
- 中文，简洁，说明"做了什么"而非"改了哪个文件"
- 50 字符以内

### 4. 执行提交

```bash
git commit -m "<message>"
```

### 5. 输出结果

显示提交结果（hash + message）。
