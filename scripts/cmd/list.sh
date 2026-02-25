#!/bin/bash
# 命令: list — 列出所有 worktree

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
