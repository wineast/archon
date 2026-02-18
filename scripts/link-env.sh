#!/bin/bash
# 创建 web/.env.local -> .vercel/.env.development.local 的符号链接
# 支持传入 target_dir 参数（worktree 场景），默认当前目录

set -e

target_dir="${1:-.}"

if [ -f "$target_dir/web/.vercel/.env.development.local" ] && [ ! -L "$target_dir/web/.env.local" ]; then
    ln -sf .vercel/.env.development.local "$target_dir/web/.env.local"
    echo "Linked $target_dir/web/.env.local → .vercel/.env.development.local"
fi
