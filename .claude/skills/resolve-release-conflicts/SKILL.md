---
name: resolve-release-conflicts
description: 发布冲突解决。集成分支（dev）合并上游（main）时产生的冲突。在 /ship 链路开始前或用户说"发布冲突"、"dev 和 main 冲突了"等时调用。
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

解决 dev 合并 main 时产生的冲突，确保集成分支包含上游所有变更后再进入发布流程。

## 与 /resolve-conflicts 的区别

| | /resolve-conflicts | /resolve-release-conflicts |
|---|---|---|
| 场景 | worktree 同步上游（`wt-sync`） | dev 合并 main（发布前） |
| 冲突来源 | 其他 worktree 的变更合入 dev | main 上的热修复/直接提交 |
| 策略偏向 | ours（当前 worktree 是开发目标） | theirs（main 是生产基线，必须保留） |
| 前置条件 | 在 worktree 内 | 在 dev 分支上 |

## 核心原则

**main 是生产基线，dev 必须完全包含 main 的所有内容。** 冲突时优先保留 main 的变更，dev 侧的变更在此基础上适配合入。

## 前置条件

- 必须在 `dev` 分支上
- 工作区处于合并冲突状态（由 `git merge origin/main` 产生）

## 流程

### 1. 确认冲突状态

```bash
git branch --show-current
# 预期：dev

git status
# 预期：显示 "You have unmerged paths"
```

如果不在 dev 上或没有冲突，终止。

### 2. 分析冲突来源

```bash
# 列出冲突文件
git diff --name-only --diff-filter=U

# 查看 main 上有哪些 dev 没有的 commit（理解上游变更意图）
git log dev..origin/main --oneline
```

对每个冲突文件分析两侧意图：
- **ours（dev）**：集成分支上积累的开发变更
- **theirs（main）**：生产环境的热修复或直接提交

### 3. 解决冲突

对每个冲突文件：

1. 使用 `Read` 读取完整文件
2. 分析冲突区域，按以下优先级决定：
   - **main 的热修复必须保留** — 这是生产环境已验证的修复
   - **dev 的变更在 main 基础上适配** — 如果 dev 改了同一处，确保 main 的修复不丢失
   - **两侧互补的直接合并** — 不同位置的改动保留双方
3. 使用 `Edit` 工具移除冲突标记，写入合并后的代码

所有冲突解决后：

```bash
git add -A
git commit --no-edit
```

### 4. 特殊冲突类型

#### Schema 冲突（`web/src/db/schema.ts`、`drizzle/`）

main 上可能有紧急的 schema 修复。处理：
1. 保留 main 的 schema 变更
2. dev 的 schema 变更在此基础上叠加
3. 解决后需要 `make db-push` 验证 schema 一致性

#### 导出格式迁移冲突（`web/src/lib/versions/migrations/`）

与 /resolve-conflicts 处理方式相同：
1. 保留 main 上的迁移文件不变
2. 重排序 dev 上的迁移文件（重命名序号 + 修改 fromVersion/toVersion）
3. 更新 `index.ts` 注册顺序和 `CURRENT_EXPORT_VERSION`

#### 依赖冲突（`package.json`、`package-lock.json`）

```bash
# 先接受 main 的版本
git checkout --theirs web/package.json web/package-lock.json
cd web && npm install
git add package.json package-lock.json
```

然后手动检查 dev 是否新增了 main 没有的依赖，补充到 `package.json` 后重新 `npm install`。

### 5. 验证

```bash
make typecheck
make test
```

如果有失败，分析错误并修复，修复后重新提交。

### 6. 输出摘要

```
发布冲突已解决

冲突文件：{N} 个
- {文件 1}：{解决策略}
- {文件 2}：{解决策略}

上游 commit：{N} 个（来自 main）
验证：typecheck ✅ / test ✅
```

## 注意

- **绝不丢弃 main 的变更** — main 是生产基线，任何 main 上的修改都必须保留
- **冲突过于复杂时暂停** — 向用户说明情况，列出冲突文件和建议方向，等待确认
- **解决后 dev 必须是 main 的超集** — `git log origin/main..dev` 只有 dev 新增的 commit，`git log dev..origin/main` 应为空
