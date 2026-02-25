#!/bin/bash
# 命令: create — 创建新 worktree

cmd_create() {
    local branch_name="$1"
    local base_branch="$2"

    if [ -z "$branch_name" ]; then
        error "用法: $0 create <branch-name> [base-branch]"
        echo ""
        echo "参数:"
        echo "  branch-name   新 worktree 的名称"
        echo "  base-branch   基础分支（可选，默认当前分支）"
        echo ""
        echo "示例:"
        echo "  $0 create feature-auth          # 基于当前分支"
        echo "  $0 create hotfix main           # 基于 main 分支"
        echo "  $0 create fix-bug staging       # 基于 staging 分支"
        exit 1
    fi

    ensure_worktrees_dir

    # 确定基础分支：指定的 > 当前分支
    if [ -z "$base_branch" ]; then
        base_branch=$(get_current_branch)
        info "使用当前分支作为基础: $base_branch"
    else
        # 验证指定的分支是否存在（本地或远程）
        if ! git show-ref --verify --quiet "refs/heads/$base_branch" 2>/dev/null; then
            # 尝试从远程获取
            if git show-ref --verify --quiet "refs/remotes/origin/$base_branch" 2>/dev/null; then
                info "从远程获取分支: origin/$base_branch"
                git fetch origin "$base_branch:$base_branch" 2>/dev/null || true
            else
                error "分支不存在: $base_branch"
                echo "可用的本地分支:"
                git branch --list | sed 's/^/  /'
                exit 1
            fi
        fi
        info "使用指定分支作为基础: $base_branch"
    fi

    local date_suffix=$(get_date_suffix)
    local full_branch="${base_branch}-${branch_name}-${date_suffix}"
    local worktree_path="$WORKTREES_DIR/$branch_name"

    # 检查是否已存在
    if [ -d "$worktree_path" ]; then
        error "Worktree 已存在: $worktree_path"
        exit 1
    fi

    # 检查分支是否已存在
    if git show-ref --verify --quiet "refs/heads/$full_branch" 2>/dev/null; then
        warn "分支 $full_branch 已存在，使用已有分支"
        git worktree add "$worktree_path" "$full_branch"
    else
        info "创建新分支: $full_branch (基于 $base_branch)"
        git worktree add -b "$full_branch" "$worktree_path" "$base_branch"
    fi

    success "Worktree 创建成功: $worktree_path"

    # 复制 web/.vercel 配置
    if [ -d "$PROJECT_ROOT/web/.vercel" ]; then
        local target_dir="$worktree_path/web/.vercel"
        mkdir -p "$worktree_path/web"
        cp -r "$PROJECT_ROOT/web/.vercel" "$target_dir"
        info "已复制 web/.vercel"
    fi

    # 随机分配端口
    local dev_port=$(( RANDOM % 5000 + 4000 ))  # 4000-8999
    local storybook_port=$(( dev_port + 1 ))
    local studio_port=$(( dev_port + 2 ))
    local inngest_port=$(( dev_port + 3 ))
    local wt_config_dir="$worktree_path/.worktree"

    # 静态环境初始化（通过环境变量传端口和 baseBranch）
    info "初始化工作区环境..."
    WT_DEV_PORT=$dev_port WT_SB_PORT=$storybook_port WT_STUDIO_PORT=$studio_port WT_INNGEST_PORT=$inngest_port WT_BASE_BRANCH="$base_branch" \
        "$PROJECT_ROOT/scripts/wt-setup.sh" "$worktree_path"
    # 数据初始化
    "$PROJECT_ROOT/scripts/wt-init.sh" "$worktree_path"
    success "工作区环境初始化完成"

    # 生成 CLAUDE.local.md（提醒 Claude 使用正确的端口）
    sed -e "s|{{WORKTREE_PATH}}|$worktree_path|g" \
        -e "s|{{DEV_PORT}}|$dev_port|g" \
        -e "s|{{STORYBOOK_PORT}}|$storybook_port|g" \
        -e "s|{{STUDIO_PORT}}|$studio_port|g" \
        -e "s|{{INNGEST_PORT}}|$inngest_port|g" \
        "$SCRIPT_DIR/claude-local.tpl" > "$worktree_path/CLAUDE.local.md"
    info "已生成 CLAUDE.local.md (dev=$dev_port)"

    # 复制 init.sh 和 cleanup.sh（如果存在）
    if [ -f "$WORKTREE_CONFIG_DIR/init.sh" ]; then
        cp "$WORKTREE_CONFIG_DIR/init.sh" "$wt_config_dir/"
        chmod +x "$wt_config_dir/init.sh"
    fi
    if [ -f "$WORKTREE_CONFIG_DIR/cleanup.sh" ]; then
        cp "$WORKTREE_CONFIG_DIR/cleanup.sh" "$wt_config_dir/"
        chmod +x "$wt_config_dir/cleanup.sh"
    fi

    # 执行 init.sh
    if [ -f "$wt_config_dir/init.sh" ]; then
        info "执行初始化脚本..."
        cd "$worktree_path"
        bash "$wt_config_dir/init.sh"
        success "初始化完成"
    fi

    # 链接 auto memory（共享主项目的 Claude Code 自动记忆）
    link_auto_memory "$worktree_path"

    echo ""
    echo "=========================================="
    echo "Worktree 就绪"
    echo "路径: $worktree_path"
    echo "分支: $full_branch"
    echo ""
    echo "下一步:"
    echo "  cd $worktree_path"
    echo "  code ."
    echo "=========================================="
}
