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

    # 检查工作区是否有未提交的更改
    cd "$worktree_path"
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        error "工作区有未提交的更改，请先提交或 stash"
        git status --short
        exit 1
    fi
    cd "$PROJECT_ROOT"

    info "合并 $wt_branch → $base_branch"

    # 切到 base 分支
    local current_branch
    current_branch=$(get_current_branch)

    if [ "$current_branch" != "$base_branch" ]; then
        info "切换到 $base_branch ..."
        git checkout "$base_branch"
    fi

    # 合并
    if git merge "$wt_branch"; then
        success "已合并 $wt_branch → $base_branch"
        echo ""
        echo "下一步（可选）："
        echo "  make wt-delete NAME=$target    # 删除工作区"
    else
        error "合并冲突，请手动解决后提交"
        exit 1
    fi
}
