#!/bin/bash
# 同步上游分支到当前工作区

cmd_sync() {
    # 确认当前在 worktree 中
    local meta="$PROJECT_ROOT/.worktree/meta.json"
    if [ ! -f "$meta" ]; then
        error "当前不在 worktree 中（找不到 .worktree/meta.json）"
        exit 1
    fi

    local base_branch
    base_branch=$(node -p "require('$meta').baseBranch" 2>/dev/null)
    if [ -z "$base_branch" ]; then
        error "无法读取 base 分支"
        exit 1
    fi

    info "当前分支: $(get_current_branch)"
    info "上游分支: $base_branch (本地)"

    # 检查当前工作区是否干净
    if ! git diff --quiet || ! git diff --cached --quiet; then
        error "工作区有未提交的变更，请先提交后再同步"
        exit 1
    fi

    # 检查上游 worktree 是否有未提交修改
    local upstream_path
    upstream_path=$(git worktree list --porcelain | awk -v br="$base_branch" '
        /^worktree / { path=$2 }
        /^branch / && $2 == "refs/heads/" br { print path }
    ')

    if [ -n "$upstream_path" ]; then
        if ! git -C "$upstream_path" diff --quiet 2>/dev/null || \
           ! git -C "$upstream_path" diff --cached --quiet 2>/dev/null; then
            error "上游工作区 ($upstream_path) 有未提交的修改，请先去上游提交"
            exit 1
        fi
    fi

    # 合并上游分支
    info "合并 $base_branch..."
    if git merge "$base_branch"; then
        success "合并成功"
    else
        error "合并有冲突，请执行 /resolve-conflicts 解决"
        exit 1
    fi

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

    success "同步完成"
}
