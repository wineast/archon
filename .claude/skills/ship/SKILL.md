---
name: ship
description: 发布链路编排。自动执行完整发布链路：集成→发布检查→人工评审→合并 PR→归档。在 dev 等集成分支上，当用户说"发货"、"ship"、"一键发布"、"集成+发布"时调用。
allowed-tools: Read, Glob, Skill, AskUserQuestion, Bash
---

自动编排完整发布链路，从断点处继续执行直到完成。

## 链路步骤

| 步骤 | 技能/操作 | 产出 |
|------|-----------|------|
| 1. 集成 | `/integrate` | `.worktree/INTEGRATE.md` |
| 2. 发布 | `/release` | `.worktree/RELEASE_REPORT.md` + PR |
| 3. 评审 | 人工确认 | 用户决定是否合并 |
| 4. 合并 | `gh pr merge` | PR 合并到 main |
| 5. 归档 | `/archive` | `releases/vN/` |

## 执行流程

### 1. 检查分支

确认当前在 `dev`（或其他集成分支），不在 `main` 或工作区分支上。如果不在集成分支，停止并告知用户。

### 2. 检查链路进度

按文件存在性和 PR 状态判断已完成的步骤：
- `.worktree/INTEGRATE.md` 存在 → 步骤 1 已完成
- `.worktree/RELEASE_REPORT.md` 存在 → 步骤 2 已完成
- dev→main 的 PR 已 merged → 步骤 3-4 已完成
- `.worktree/INTEGRATE.md` 不存在且 `releases/` 中有最新版本 → 步骤 5 已完成

输出当前进度摘要（哪些步骤已完成，从哪一步开始）。

### 3. 执行集成和发布（步骤 1-2）

对每个未完成的步骤依次调用对应技能（使用 Skill 工具）：
1. 调用技能
2. 确认产出文件已生成
3. 如果产出文件缺失，停止链路并报告失败
4. 继续下一步

### 4. 人工评审（步骤 3）

`/release` 完成后会创建 PR 并启动报告查看器。用 `AskUserQuestion` 提示用户：

> 发布 PR 已创建，请在浏览器中查看报告和 PR。确认可以合并吗？

选项：
- **合并并归档** — 继续执行步骤 4-5
- **暂不合并** — 停止链路，用户稍后手动处理

如果用户选择"暂不合并"，输出当前进度并停止。

### 5. 合并 PR（步骤 4）

```bash
# 找到 dev→main 的 open PR
gh pr list --base main --head dev --state open --json number --jq '.[0].number'

# 合并 PR（squash merge）
gh pr merge {number} --squash
```

合并后等待确认：

```bash
gh pr view {number} --json state --jq '.state'
# 预期返回 "MERGED"
```

### 6. 归档（步骤 5）

调用 `/archive` 技能，将本次发布涉及的任务和报告移入 `releases/vN/`。

### 7. 完成总结

输出链路完成总结，列出每个步骤的状态。

## 关键约束

- **幂等**：已完成的步骤直接跳过
- **失败即停**：任何步骤失败则中断链路
- **分支约束**：必须在 `dev` 等集成分支上执行
- **人工门控**：合并 PR 前必须获得用户明确确认，不自动合并
