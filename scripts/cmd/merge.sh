#!/bin/bash
# 命令: merge — 合并工作区分支回 base 分支

cmd_merge() {
    local target="$1"

    if [ -z "$target" ]; then
        error "用法: $0 merge <worktree-name>"
        echo ""
        echo "当前 worktrees:"
        git worktree list
        exit 1
    fi

    local worktree_path="$WORKTREES_DIR/$target"

    if [ ! -d "$worktree_path" ]; then
        error "Worktree 不存在: $worktree_path"
        exit 1
    fi

    # 读取 base 分支
    local meta_json="$worktree_path/.worktree/meta.json"
    if [ ! -f "$meta_json" ]; then
        error "找不到 .worktree/meta.json，无法确定 base 分支"
        exit 1
    fi

    local base_branch
    base_branch=$(node -p "require('$meta_json').baseBranch")

    if [ -z "$base_branch" ]; then
        error "meta.json 中没有 baseBranch 字段"
        exit 1
    fi

    # 获取工作区分支名
    local wt_branch
    wt_branch=$(git -C "$worktree_path" rev-parse --abbrev-ref HEAD)

    # ── 前置检查 ──────────────────────────────────────────────

    # 1. 检查工作区是否有未提交的更改
    cd "$worktree_path"
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        error "工作区有未提交的更改，请先提交或 stash"
        git status --short
        exit 1
    fi
    cd "$PROJECT_ROOT"

    # 2. 检查主仓库是否有未提交的更改
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        error "主仓库有未提交的更改，请先提交或 stash"
        git status --short
        exit 1
    fi

    # 3. 检查工作区是否落后上游（上游有新 commit 未同步）
    local behind_count
    behind_count=$(git -C "$worktree_path" rev-list HEAD.."$base_branch" --count 2>/dev/null || echo "0")
    if [ "$behind_count" != "0" ]; then
        error "工作区落后上游 $behind_count 个 commit，请先同步: make wt-sync"
        exit 1
    fi

    # 4. 合并冲突预检（避免 checkout 后才发现冲突）
    if ! git merge-tree --write-tree "$base_branch" "$wt_branch" >/dev/null 2>&1; then
        error "检测到合并冲突，请先在工作区中解决冲突"
        echo ""
        echo "提示："
        echo "  cd $worktree_path"
        echo "  git merge $base_branch    # 解决冲突后 commit"
        exit 1
    fi

    # ── 执行合并 ──────────────────────────────────────────────

    info "合并 $wt_branch → $base_branch"

    # 记录当前分支，合并失败时回退
    local current_branch
    current_branch=$(get_current_branch)

    if [ "$current_branch" != "$base_branch" ]; then
        info "切换到 $base_branch ..."
        git checkout "$base_branch"
    fi

    # Squash 合并：将工作区所有 commit 压缩为 1 个
    if git merge --squash "$wt_branch"; then
        # 收集工作区 commit 摘要作为 commit body
        local commit_log
        commit_log=$(git log "$base_branch".."$wt_branch" --oneline --no-merges 2>/dev/null || true)

        git commit -m "feat($target): squash merge from $wt_branch" -m "$commit_log"
        success "已合并 $wt_branch → $base_branch（squash）"

        # 检查依赖文件是否有变更，有则自动安装
        local merge_diff
        merge_diff=$(git diff HEAD~1 --name-only 2>/dev/null || true)

        if echo "$merge_diff" | grep -q "package-lock.json\|package.json"; then
            info "检测到依赖文件变更，执行 npm install..."
            if [ -d "$PROJECT_ROOT/web" ]; then
                (cd "$PROJECT_ROOT/web" && npm install)
                success "依赖安装完成"
            fi
        fi

        echo ""
        echo "下一步（可选）："
        echo "  make wt-delete NAME=$target    # 删除工作区"
    else
        error "合并失败，回退到 $current_branch"
        git merge --abort 2>/dev/null || true
        if [ "$current_branch" != "$base_branch" ]; then
            git checkout "$current_branch"
        fi
        exit 1
    fi
}
