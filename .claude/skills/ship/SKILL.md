---
name: ship
description: 发布链路编排。自动执行完整发布链路：集成→发布检查→人工评审→合并 PR→归档。在 dev 等集成分支上，当用户说"发货"、"ship"、"一键发布"、"集成+发布"时调用。
allowed-tools: Read, Glob, Skill, AskUserQuestion, Bash
---

自动编排完整发布链路，从断点处继续执行直到完成。

## 版本号

使用语义化版本 `vX.Y.Z`：
- **Major (X)**：有 breaking change 时递增
- **Minor (Y)**：有新功能时递增
- **Patch (Z)**：仅有 bug 修复时递增

自动推断规则：读取最新 git tag（`git tag --sort=-v:refname | head -1`），根据集成报告的 Breaking 和 Additions 判断 bump 类型。无 tag 时从 `v0.1.0` 开始。用 `AskUserQuestion` 让用户确认或覆盖版本号。

## 链路步骤

| 步骤 | 技能/操作 | 产出 |
|------|-----------|------|
| 1. 集成 | `/integrate` | `.release/INTEGRATE.md` |
| 2. 发布检查 | `/release` | `.release/RELEASE_REPORT.md` + 发布 PR（dev→main） |
| 3. 评审 | 人工确认 | 用户决定是否合并 |
| 4. 合并发布 PR | `gh pr merge` | 代码合并到 main |
| 5. 归档 | `/archive` | 在 dev 上生成 `releases/vX.Y.Z/` |
| 6. 发布内容 | `/release-notes` | `SOCIAL.md` + `DEMO.md` |
| 7. 归档 PR | `gh pr create` + `gh pr merge` | 归档内容合并到 main + git tag |

## 执行流程

### 1. 检查分支

确认当前在 `dev`（或其他集成分支），不在 `main` 或工作区分支上。如果不在集成分支，停止并告知用户。

### 2. 检查链路进度

按文件存在性和 PR 状态判断已完成的步骤：
- `.release/INTEGRATE.md` 存在 → 步骤 1 已完成
- `.release/RELEASE_REPORT.md` 存在 → 步骤 2 已完成
- dev→main 的发布 PR 已 merged → 步骤 3-4 已完成
- `releases/vX.Y.Z/` 目录存在但未推送到 main → 步骤 5-6 已完成，需执行步骤 7

输出当前进度摘要（哪些步骤已完成，从哪一步开始）。

### 3. 执行集成和发布检查（步骤 1-2）

对每个未完成的步骤依次调用对应技能（使用 Skill 工具）：
1. 调用技能
2. 确认产出文件已生成
3. 如果产出文件缺失，停止链路并报告失败
4. 继续下一步

### 4. 人工评审（步骤 3）

`/release` 完成后会创建发布 PR。用 `AskUserQuestion` 提示用户：

> 发布 PR 已创建，请查看报告和 PR。确认可以合并吗？

选项：
- **合并并归档** — 继续执行步骤 4-7
- **暂不合并** — 停止链路，用户稍后手动处理

如果用户选择"暂不合并"，输出当前进度并停止。

### 5. 合并发布 PR（步骤 4）

```bash
# 找到 dev→main 的 open PR
gh pr list --base main --head dev --state open --json number --jq '.[0].number'

# 合并 PR（squash merge）
gh pr merge {number} --squash
```

合并后确认状态并**重置 dev 到 main**（squash merge 后历史分叉，必须重置）：

```bash
gh pr view {number} --json state --jq '.state'
# 预期返回 "MERGED"

git fetch origin main
git reset --hard origin/main
```

### 6. 归档 + 发布内容（步骤 5-6）

调用 `/archive` 技能，在 dev 上生成 `releases/vX.Y.Z/` 目录。
调用 `/release-notes` 技能，在 `releases/vX.Y.Z/` 中生成 SOCIAL.md + DEMO.md。

### 7. 归档 PR（步骤 7）

归档内容准备好后，创建一个**单独的 PR** 将归档合并到 main：

```bash
# 提交归档内容
git add releases/vX.Y.Z/ todo/ issues/
git commit -m "chore: archive release vX.Y.Z"

# 推送 dev
git push origin dev

# 创建归档 PR
gh pr create --base main --head dev \
  --title "chore: archive release vX.Y.Z" \
  --body "归档 vX.Y.Z 发布内容到 releases/ 目录"

# 合并归档 PR（不需要人工评审，内容已确认）
gh pr merge --squash

# 打 tag 到 main
git fetch origin main
git reset --hard origin/main
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 8. 完成总结

输出链路完成总结，列出每个步骤的状态和版本号。

## 关键约束

- **语义化版本**：版本号格式 `vX.Y.Z`，自动推断 + 用户确认
- **幂等**：已完成的步骤直接跳过
- **失败即停**：任何步骤失败则中断链路
- **分支约束**：必须在 `dev` 等集成分支上执行
- **人工门控**：合并发布 PR 前必须获得用户明确确认
- **归档走 PR**：归档内容通过独立 PR 合并到 main，不直接 push
- **Squash 后重置**：每次 squash merge 后必须 `git reset --hard origin/main` 重置 dev
