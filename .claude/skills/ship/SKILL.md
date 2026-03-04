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
| 2. 发布检查 | `/release` | `.release/RELEASE_REPORT.md` |
| 3. 归档 | `/archive` | `releases/vX.Y.Z/` |
| 4. 发布内容 | `/release-notes` | `SOCIAL.md` + `DEMO.md` |
| 5. 创建 PR | `gh pr create` | 代码 + 归档 + 发布文案，一个 PR |
| 6. 评审 | 人工确认 | 用户决定是否合并 |
| 7. 合并 + Tag | `gh pr merge` + `git tag` | 合并到 main + 打 tag |

## 执行流程

### 1. 检查分支 + 同步上游

确认当前在 `dev`（或其他集成分支），不在 `main` 或工作区分支上。如果不在集成分支，停止并告知用户。

同步上游 main：

```bash
git fetch origin main
git merge origin/main
```

- 无冲突 → 继续
- 有冲突 → 调用 `/resolve-release-conflicts` 技能解决后继续

### 2. 检查链路进度

按文件存在性和 PR 状态判断已完成的步骤：
- `.release/INTEGRATE.md` 存在 → 步骤 1 已完成
- `.release/RELEASE_REPORT.md` 存在 → 步骤 2 已完成
- `releases/vX.Y.Z/` 目录存在 → 步骤 3-4 已完成
- dev→main 的 PR 已 merged → 步骤 5-7 已完成

输出当前进度摘要（哪些步骤已完成，从哪一步开始）。

### 3. 执行集成和发布检查（步骤 1-2）

对每个未完成的步骤依次调用对应技能（使用 Skill 工具）：
1. 调用技能
2. 确认产出文件已生成
3. 如果产出文件缺失，停止链路并报告失败
4. 继续下一步

### 4. 更新版本号 + 归档 + 发布内容（步骤 3-4）

更新 `web/package.json` 的 `version` 字段为本次版本号（去掉 `v` 前缀，如 `v0.2.0` → `"version": "0.2.0"`）。主页 footer 会自动读取此字段展示版本号。

调用 `/archive` 技能，在 dev 上生成 `releases/vX.Y.Z/` 目录。
调用 `/release-notes` 技能，在 `releases/vX.Y.Z/` 中生成 SOCIAL.md + DEMO.md。

### 5. 创建 PR（步骤 5）

一个 PR 包含所有内容（代码变更 + 归档 + 发布文案）：

```bash
git push origin dev

gh pr create --base main --head dev \
  --title "release: vX.Y.Z" \
  --body "$(cat <<'EOF'
## Verdict

{✅ 发布 / ⚠️ 有条件发布}

## Changes

### 新功能
{从 Release Notes 提取}

### 缺陷修复
{从 Release Notes 提取}

### 其他
{从 Release Notes 提取}

## Breaking Changes
{从集成报告的 Breaking 提取。无则写"无"}

## Verification
- **Regression**: {一句话}
- **Cross-feature**: {一句话}
- **Migration**: {一句话}
- **Report**: [RELEASE_REPORT.md](.release/RELEASE_REPORT.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 6. 人工评审（步骤 6）

用 `AskUserQuestion` 提示用户：

> 发布 PR 已创建，包含代码变更、归档和发布文案。请查看后确认是否合并。

选项：
- **合并并发布** — 继续执行步骤 7
- **暂不合并** — 停止链路，用户稍后手动处理

如果用户选择"暂不合并"，输出当前进度并停止。

### 7. 合并 + Tag（步骤 7）

```bash
# 找到 dev→main 的 open PR
gh pr list --base main --head dev --state open --json number --jq '.[0].number'

# 合并 PR（regular merge）
gh pr merge {number} --merge

# 同步 dev 并打 tag
git pull origin main
git push origin dev
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
- **同步上游**：开始前必须 `git merge origin/main`，有冲突则调用 `/resolve-release-conflicts`
- **单 PR**：代码 + 归档 + 发布文案在同一个 PR 中，合并前用户可完整评审
- **人工门控**：合并 PR 前必须获得用户明确确认
- **Regular Merge**：dev→main 使用 regular merge（不 squash），保留 commit 历史，dev 和 main 自然同步
