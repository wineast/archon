---
name: test-wt
description: 工作区测试补全。当用户说"补测试"、"写测试"、"测试覆盖"、"test"、"加 E2E"等时调用。同步上游、收集变更、理解需求和实现，直接编写并执行最全面的测试用例。
allowed-tools: AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, Skill
---

工作区测试补全——同步上游、收集变更，理解需求和实现后直接编写并执行最全面的测试用例。

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

### 3. 理解需求和实现

- 如果工作区根目录有 `req.sh`，从中提取需求基线
- 通读变更代码，理解功能逻辑、数据流、边界情况
- 扫描已有测试（`__tests__/`、`web/e2e/`、`.stories.tsx`），了解测试基础设施（mock 方式、fixture、helper）

### 4. 编写测试

基于对需求和实现的理解，直接编写覆盖最全面的测试代码：

**单元测试（Vitest + Testing Library）**：
- 文件放在对应模块的 `__tests__/` 下
- 参考同目录已有测试的模式（mock 方式、import 路径等）
- 覆盖：正常路径、边界值、异常/错误处理、参数校验

**Storybook**：
- 新增/修改的 UI 组件必须有对应 `.stories.tsx`
- 遵循 CLAUDE.md 中 Storybook 约定
- 覆盖：各状态（默认、加载、空、错误）、各变体、交互场景

**E2E 测试（Playwright）**：
- 文件放在 `web/e2e/` 下
- 遵循 CLAUDE.md 中 E2E 测试约定
- 覆盖：核心用户流程、关键交互路径

### 5. 运行验证

```bash
make typecheck
make test
```

如有 E2E 测试，提示用户需要 `make up` 后运行 `make e2e`。

### 6. 输出测试报告

将测试报告写入工作区根目录 `test-report.md`：

```markdown
# 测试报告：{工作区名}

## 变更概述
{一句话概述本次变更}

## 新增测试

### 单元测试
| 文件 | 用例数 | 覆盖场景 |
|------|--------|---------|
| {path} | {n} | {场景列表} |

### Storybook
| 文件 | Story 数 | 覆盖状态 |
|------|----------|---------|
| {path} | {n} | {状态列表} |

### E2E 测试
| 文件 | 用例数 | 覆盖流程 |
|------|--------|---------|
| {path} | {n} | {流程列表} |

## 运行结果
- typecheck: ✅/❌
- test: ✅/❌ ({passed}/{total})
- e2e: ⏳ 需 `make up` 后运行 `make e2e`

## 需求覆盖度（如有 req.sh）
- ✅ / ❌ 逐条
```

## 执行规则

1. **直接编写，不追问**：理解需求和实现后直接写测试，不做方案评审、不逐项确认
2. **覆盖最全面**：目标是最完整的测试覆盖，正常路径+边界+异常全覆盖
3. **参考现有模式**：新测试的风格必须与项目已有测试一致
4. **测试金字塔**：单元 > Storybook > E2E，优先用低成本层级覆盖
5. **对照需求**：有 `req.sh` 时，确保需求中的关键功能点都有测试覆盖
