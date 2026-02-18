#!/bin/bash
# 命令: delete — 删除 worktree

cmd_delete() {
    local target="$1"

    if [ -z "$target" ]; then
        error "用法: $0 delete <worktree-name>"
        echo ""
        echo "当前 worktrees:"
        git worktree list
        exit 1
    fi

    local worktree_path="$WORKTREES_DIR/$target"

    # 如果不是完整路径，尝试匹配
    if [ ! -d "$worktree_path" ]; then
        # 尝试在 .worktrees 下模糊匹配
        local matches=$(find "$WORKTREES_DIR" -maxdepth 1 -type d -name "*$target*" 2>/dev/null | grep -v "^$WORKTREES_DIR$")
        local count=$(echo "$matches" | grep -c . 2>/dev/null || echo 0)

        if [ "$count" -eq 0 ]; then
            error "找不到匹配的 worktree: $target"
            exit 1
        elif [ "$count" -gt 1 ]; then
            error "匹配到多个 worktree，请指定更精确的名称:"
            echo "$matches"
            exit 1
        else
            worktree_path="$matches"
        fi
    fi

    # 检查是否有未提交的更改
    if [ -d "$worktree_path" ]; then
        cd "$worktree_path"
        if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
            warn "Worktree 有未提交的更改!"
            git status --short
            echo ""
            read -p "确定要删除吗? (y/N) " confirm
            if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
                info "已取消"
                exit 0
            fi
        fi
        cd "$PROJECT_ROOT"
    fi

    # 执行 cleanup.sh
    local wt_config_dir="$worktree_path/.worktree"
    if [ -f "$wt_config_dir/cleanup.sh" ]; then
        info "执行清理脚本..."
        cd "$worktree_path"
        bash "$wt_config_dir/cleanup.sh" || true
        cd "$PROJECT_ROOT"
    fi

    # 终止工作区启动的服务（dev server / storybook / drizzle studio）
    kill_worktree_services "$worktree_path"

    # 清理工作区数据（drop DB + 删元数据）
    "$PROJECT_ROOT/scripts/wt-fini.sh" "$worktree_path"
    # 清理工作区静态环境（删缓存/依赖 + 删环境文件）
    "$PROJECT_ROOT/scripts/wt-teardown.sh" "$worktree_path"

    # 删除 worktree
    info "删除 worktree: $worktree_path"
    git worktree remove "$worktree_path" --force

    success "Worktree 已删除"
}
