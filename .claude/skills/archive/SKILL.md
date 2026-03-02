---
name: archive
description: 发布归档。PR 合并到 main 后调用。将本次发布涉及的任务和报告移入 releases/vN/ 目录，清理已合并的工作区。当用户说"归档"、"archive"、"发布完成"、"PR 已合并"等时调用。
allowed-tools: Read, Glob, Grep, Bash, Edit
---

PR 合并后归档：创建版本目录 + 移动任务文件 + 归档工作区报告 + 清理工作区。

## 核心理念

`/integrate` 扫描 `todo/` 和 `issues/` 中 `status: merged` 的任务。PR 合并到 main 后，这些任务必须从活跃目录中移走，否则下次 `/integrate` 会重复扫描。

归档 = 物理隔离 + 版本封存。每次归档创建一个 `releases/vN/` 目录，将任务文件、工作区报告、集成/发布报告全部移入，形成自包含的版本快照。

## 目录结构

```
releases/
  v1/                          ← 第一次发布
    todo/                      ← 本次发布的 todo 任务文件
      chat-link-rendering.md
    issues/                    ← 本次发布的 issue 任务文件
      cross-agent-wiki-data-leak.md
    worktrees/                 ← 工作区报告（仅 .task/ 目录，不含代码）
      chat-link-rendering/
        .task/
          REQ.md
          IMPL_REPORT.md
          ACCEPT_REPORT.md
      cross-agent-wiki-data-leak/
        .task/
          DEFECT.md
          FIX_REPORT.md
          VERIFY_REPORT.md
    INTEGRATE.md               ← 集成报告
    RELEASE_REPORT.md          ← 发布报告
    RELEASE_REPORT.assets/     ← 发布报告截图（如有）
  v2/                          ← 第二次发布
    ...
```

## 执行流程

### 1. 确认 PR 已合并

检查 dev→main 的最近 merged PR：

```bash
gh pr list --base main --head dev --state merged --limit 1 --json number,mergedAt,title
```

如果没有找到 merged PR，提示用户确认。

### 2. 确定版本号

扫描 `releases/` 目录，找到最大的 `vN`，新版本为 `v{N+1}`。如果 `releases/` 不存在则从 `v1` 开始。

### 3. 读取集成报告

读取 `.release/INTEGRATE.md`，从 Scope 部分提取本次发布涉及的任务列表（任务 ID + 类型 + 工作区名称）。

如果 `.release/INTEGRATE.md` 不存在，停止并告知用户缺少集成报告。

### 4. 创建版本目录

```bash
mkdir -p releases/vN/todo releases/vN/issues releases/vN/worktrees
```

### 5. 移动任务文件

对每个涉及的任务：

```bash
# todo 类型
mv todo/{id}.md releases/vN/todo/

# issue 类型
mv issues/{id}.md releases/vN/issues/
```

### 6. 归档工作区报告

对每个涉及的工作区：

```bash
# 仅复制 .task/ 报告目录（不含代码）
mkdir -p releases/vN/worktrees/{name}
cp -r .worktrees/{name}/.task releases/vN/worktrees/{name}/
```

### 7. 移动集成/发布报告

```bash
mv .release/INTEGRATE.md releases/vN/
mv .release/RELEASE_REPORT.md releases/vN/
# 如果有截图
mv .release/RELEASE_REPORT.assets/ releases/vN/ 2>/dev/null || true
```

### 8. 清理已合并的工作区

对每个涉及的工作区，删除完整的 worktree 目录（代码已合并，报告已归档）：

```bash
rm -rf .worktrees/{name}
```

### 9. 提交归档并打 tag

```bash
git add releases/vN/ todo/ issues/
git commit -m "chore: archive release vN"
git tag vN
```

### 10. 输出归档摘要

```
📦 Release vN 归档完成

已归档任务：
| 任务 | 类型 | 标题 |
|------|------|------|
| xxx  | todo | ... |
| yyy  | issue | ... |

已归档工作区报告：{N} 个
已清理工作区：{N} 个
版本目录：releases/vN/
```

## 关键约束

- **仅操作本次发布涉及的任务**：从 INTEGRATE.md 的 Scope 提取任务列表，不是扫描所有 `merged` 任务
- **幂等**：如果任务文件已不在 `todo/` 或 `issues/`（已被移走），跳过
- **报告先归档再清理**：必须先 `cp` 报告到版本目录，再 `rm` 工作区
- **不可逆**：归档后任务不会回到活跃目录
- **版本号递增**：自动从 `releases/` 目录推断下一个版本号
