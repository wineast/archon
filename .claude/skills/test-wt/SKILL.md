---
name: test-wt
description: 工作区测试补全。当用户说"补测试"、"写测试"、"测试覆盖"、"test"、"加 E2E"等时调用。同步上游、收集变更、分析测试覆盖缺口，追问确认后直接编写测试代码。
allowed-tools: AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, Skill
---

工作区测试补全——同步上游、收集变更，分析测试覆盖缺口，追问用户确认后直接编写测试代码。

## 前置条件

必须在 worktree 内执行（`.worktree/meta.json` 存在）。

## 流程

### 1. 同步上游

调用 `/sync-upstream` 技能，确保变更基于最新上游。

### 2. 收集变更

读取 `.worktree/meta.json` 获取 `baseBranch`，收集全部变更：

```bash
git log <baseBranch>..HEAD --oneline
git diff <baseBranch>..HEAD --stat
git diff <baseBranch>..HEAD
```

无变更则告知用户并结束。

### 3. 提取需求（可选）

如果工作区根目录有 `req.sh`，从中提取 prompt 作为需求基线，用于对照覆盖度。

### 4. 分析测试覆盖现状

扫描变更涉及的代码，调研：

- **已有单元测试**：变更文件对应的 `__tests__/` 下是否有测试？覆盖了什么场景？
- **已有 E2E**：`web/e2e/` 下是否有相关的 `.spec.ts`？覆盖了什么流程？
- **已有 Storybook**：变更的 UI 组件是否有 `.stories.tsx`？覆盖了什么状态？
- **测试基础设施**：项目用了什么 mock 方式、fixture、helper？
- **覆盖缺口**：哪些新增/修改的逻辑没有对应测试？

输出覆盖分析摘要：

```
## 测试覆盖分析

### 已覆盖
- ✅ {已有测试的逻辑}

### 未覆盖
- ❌ {缺失测试的逻辑1}
- ❌ {缺失测试的逻辑2}

### 建议新增
- 单元测试：{场景列表}
- Storybook：{组件状态列表}
- E2E 测试：{场景列表}
```

### 5. 追问用户（如有不确定项）

用 `AskUserQuestion` 确认：

- **场景优先级**：列出建议的测试场景，让用户选择要覆盖哪些
- **E2E 范围**：是否需要 E2E 测试？覆盖哪些关键流程？
- **边界情况**：对于边界行为不确定的场景，问用户预期行为

**如果覆盖缺口明确、无歧义，跳过追问直接编写。** 目标是高效补全，不是为了追问而追问。

### 6. 编写测试

直接编写测试代码，遵循项目约定：

**单元测试（Vitest + Testing Library）**：
- 文件放在对应模块的 `__tests__/` 下
- 参考同目录已有测试的模式（mock 方式、import 路径等）

**Storybook**：
- 新增/修改的 UI 组件必须有对应 `.stories.tsx`
- 遵循 CLAUDE.md 中 Storybook 约定

**E2E 测试（Playwright）**：
- 文件放在 `web/e2e/` 下
- 遵循 CLAUDE.md 中 E2E 测试约定

### 7. 运行验证

```bash
make typecheck
make test
```

如有 E2E 测试，提示用户需要 `make up` 后运行 `make e2e`。

## 执行规则

1. **目标导向**：目的是补全测试覆盖，不是做测试方案评审
2. **能写就写**：不确定的才问，确定的直接写
3. **参考现有模式**：新测试的风格必须与项目已有测试一致
4. **测试金字塔**：单元 > Storybook > E2E，优先用低成本层级覆盖
5. **对照需求**：有 `req.sh` 时，确保需求中的关键功能点都有测试覆盖
