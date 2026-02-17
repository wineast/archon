#!/bin/bash
# Git Worktree 管理脚本
# 用法: ./.claude/skills/worktree/scripts/worktree.sh [list|create|delete] [args]

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取项目根目录（使用 git 仓库根目录，而非脚本所在目录）
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WORKTREES_DIR="$PROJECT_ROOT/.worktrees"
WORKTREE_CONFIG_DIR="$PROJECT_ROOT/.worktree"

# ============================================================
# 辅助函数
# ============================================================

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

link_auto_memory() {
    local wt_path="$1"

    # Claude Code 的项目 key：绝对路径中 / 替换为 -
    local main_key=$(echo "$PROJECT_ROOT" | tr '/' '-')
    local wt_key=$(echo "$wt_path" | tr '/' '-')

    local claude_projects="$HOME/.claude/projects"
    local main_memory="$claude_projects/$main_key/memory"
    local wt_parent="$claude_projects/$wt_key"
    local wt_memory="$wt_parent/memory"

    if [ ! -d "$main_memory" ]; then
        warn "主项目 auto memory 不存在，跳过链接"
        return
    fi

    mkdir -p "$wt_parent"
    # 如果已存在且不是符号链接，先删除
    if [ -d "$wt_memory" ] && [ ! -L "$wt_memory" ]; then
        rm -rf "$wt_memory"
    fi
    ln -sf "$main_memory" "$wt_memory"
    info "已链接 auto memory → main"
}

ensure_worktrees_dir() {
    if [ ! -d "$WORKTREES_DIR" ]; then
        info "创建 .worktrees/ 目录..."
        mkdir -p "$WORKTREES_DIR"
    fi

    # 检查是否被 gitignore，如果没有则自动修复
    if ! git check-ignore -q ".worktrees" 2>/dev/null; then
        warn ".worktrees/ 未被 gitignore，自动修复..."
        echo "" >> "$PROJECT_ROOT/.gitignore"
        echo "# Worktrees directory" >> "$PROJECT_ROOT/.gitignore"
        echo ".worktrees/" >> "$PROJECT_ROOT/.gitignore"
        git add .gitignore
        git commit -m "chore: add .worktrees/ to gitignore"
        success "已自动添加 .worktrees/ 到 .gitignore 并提交"
    fi
}

get_current_branch() {
    git rev-parse --abbrev-ref HEAD
}

get_date_suffix() {
    date +%Y%m%d
}

# ============================================================
# 命令: list
# ============================================================

cmd_list() {
    echo ""
    echo "Git Worktrees:"
    echo "=============="
    git worktree list
    echo ""

    if [ -d "$WORKTREES_DIR" ]; then
        echo ".worktrees/ 目录内容:"
        echo "======================"
        ls -la "$WORKTREES_DIR" 2>/dev/null || echo "(空)"
        echo ""
    fi
}

# ============================================================
# 命令: create
# ============================================================

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

    # 创建 web/.env.local -> .vercel/.env.development.local 的符号链接
    if [ -f "$worktree_path/web/.vercel/.env.development.local" ]; then
        ln -sf .vercel/.env.development.local "$worktree_path/web/.env.local"
        info "已链接 web/.env.local -> .vercel/.env.development.local"
    fi

    # 创建 .worktree 目录（如果不存在）
    local wt_config_dir="$worktree_path/.worktree"
    if [ ! -d "$wt_config_dir" ]; then
        info "创建 .worktree/ 配置目录..."
        mkdir -p "$wt_config_dir"
    fi

    # 生成随机端口写入 port.json
    local dev_port=$(( RANDOM % 5000 + 4000 ))  # 4000-8999
    local storybook_port=$(( dev_port + 1 ))
    echo "{\"dev\":$dev_port,\"storybook\":$storybook_port}" > "$wt_config_dir/port.json"
    info "端口分配: dev=$dev_port, storybook=$storybook_port (写入 .worktree/port.json)"

    # 生成 CLAUDE.local.md（提醒 Claude 使用正确的端口）
    cat > "$worktree_path/CLAUDE.local.md" <<CLAUDE_EOF
# Worktree Local

## Dev Server
- 本工作区的 dev 端口: **$dev_port**（Storybook: $storybook_port）
- 启动命令: \`make dev\`
- 浏览器访问地址: \`http://localhost:$dev_port\`
- **当用户让你查看浏览器页面时，务必使用 http://localhost:$dev_port**
CLAUDE_EOF
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

# ============================================================
# 命令: delete
# ============================================================

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

    # 删除 worktree
    info "删除 worktree: $worktree_path"
    git worktree remove "$worktree_path" --force

    success "Worktree 已删除"
}

# ============================================================
# 命令: select-delete（交互式选择删除）
# ============================================================

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

    info "删除 worktree: $selected_path"
    git worktree remove "$selected_path" --force

    success "Worktree '$selected_name' 已删除"
}

# ============================================================
# 主入口
# ============================================================

cmd_help() {
    echo ""
    echo "Git Worktree 管理"
    echo "================"
    echo ""
    echo "用法: $0 <command> [args]"
    echo ""
    echo "命令:"
    echo "  list                       列出所有 worktree"
    echo "  create <name> [base]       创建新 worktree（可指定基础分支）"
    echo "  delete <name>              删除 worktree"
    echo "  select-delete              交互式选择删除 worktree"
    echo "  help                       显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 list"
    echo "  $0 create feature-auth              # 基于当前分支"
    echo "  $0 create hotfix main               # 基于 main 分支"
    echo "  $0 delete feature-auth"
    echo ""
}

case "${1:-help}" in
    list|ls)
        cmd_list
        ;;
    create|new|add)
        cmd_create "$2" "$3"
        ;;
    delete|remove|rm)
        cmd_delete "$2"
        ;;
    select-delete|sd)
        cmd_select_delete
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        error "未知命令: $1"
        cmd_help
        exit 1
        ;;
esac
