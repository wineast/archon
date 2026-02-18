#!/bin/bash
# Git Worktree 管理脚本
# 用法: ./.claude/skills/worktree/scripts/worktree.sh [list|create|delete] [args]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
# 加载子命令
# ============================================================

source "$SCRIPT_DIR/cmd/list.sh"
source "$SCRIPT_DIR/cmd/create.sh"
source "$SCRIPT_DIR/cmd/delete.sh"
source "$SCRIPT_DIR/cmd/select-delete.sh"
source "$SCRIPT_DIR/cmd/merge.sh"
source "$SCRIPT_DIR/cmd/sync.sh"

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
    echo "  sync                       同步上游分支到当前工作区"
    echo "  merge <name>               合并工作区分支回 base 分支"
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
    sync)
        cmd_sync
        ;;
    merge)
        cmd_merge "$2"
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
