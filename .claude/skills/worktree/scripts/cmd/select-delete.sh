#!/bin/bash
# 命令: select-delete — 交互式选择删除 worktree

cmd_select_delete() {
    # 收集非主仓库的 worktree
    local worktrees=()
    local branches=()

    while IFS= read -r line; do
        local wt_path=$(echo "$line" | awk '{print $1}')
        local wt_branch=$(echo "$line" | sed 's/.*\[\(.*\)\].*/\1/')

        # 跳过主仓库（bare 或没有在 .worktrees 下的）
        if [[ "$wt_path" != *"/.worktrees/"* ]]; then
            continue
        fi

        worktrees+=("$wt_path")
        branches+=("$wt_branch")
    done < <(git worktree list)

    if [ ${#worktrees[@]} -eq 0 ]; then
        info "没有可删除的 worktree"
        exit 0
    fi

    echo ""
    echo "可删除的 Worktrees:"
    echo "==================="
    echo ""

    for i in "${!worktrees[@]}"; do
        local wt_path="${worktrees[$i]}"
        local wt_name=$(basename "$wt_path")
        local wt_branch="${branches[$i]}"

        # 检查是否有未提交的更改
        local dirty=""
        if [ -d "$wt_path" ]; then
            cd "$wt_path"
            if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
                dirty=" ${YELLOW}[未提交更改]${NC}"
            fi
            cd "$PROJECT_ROOT"
        fi

        echo -e "  $((i+1)). ${GREEN}$wt_name${NC}  ($wt_branch)$dirty"
    done

    echo ""
    echo -e "  0. 取消"
    echo ""
    read -p "选择要删除的序号: " choice

    # 验证输入
    if [ -z "$choice" ] || [ "$choice" = "0" ]; then
        info "已取消"
        exit 0
    fi

    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#worktrees[@]} ]; then
        error "无效的选项: $choice"
        exit 1
    fi

    local idx=$((choice - 1))
    local selected_path="${worktrees[$idx]}"
    local selected_name=$(basename "$selected_path")
    local selected_branch="${branches[$idx]}"

    echo ""
    echo -e "即将删除:"
    echo -e "  路径: ${RED}$selected_path${NC}"
    echo -e "  分支: ${RED}$selected_branch${NC}"

    # 显示未提交更改详情
    if [ -d "$selected_path" ]; then
        cd "$selected_path"
        if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
            echo ""
            warn "该 worktree 有未提交的更改:"
            git status --short
        fi
        cd "$PROJECT_ROOT"
    fi

    echo ""
    read -p "确认删除? (y/N) " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        info "已取消"
        exit 0
    fi

    # 执行删除（复用清理逻辑）
    local wt_config_dir="$selected_path/.worktree"
    if [ -f "$wt_config_dir/cleanup.sh" ]; then
        info "执行清理脚本..."
        cd "$selected_path"
        bash "$wt_config_dir/cleanup.sh" || true
        cd "$PROJECT_ROOT"
    fi

    # 终止工作区启动的服务（dev server / storybook / drizzle studio）
    kill_worktree_services "$selected_path"

    info "删除 worktree: $selected_path"
    git worktree remove "$selected_path" --force

    success "Worktree '$selected_name' 已删除"
}
