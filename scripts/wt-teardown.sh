#!/bin/bash
# 工作区静态环境清理（wt-setup 的反向操作）
# 用法: ./scripts/wt-teardown.sh [target_dir]
#
# 流程: 删缓存/依赖 → 删环境文件 → 删工作区元数据

set -e

target_dir="$(cd "${1:-.}" && pwd)"

# ---- 清理缓存和依赖 ----
echo "🗑️  [wt-teardown] 清理构建缓存和依赖..."
rm -rf "$target_dir/web/.next" "$target_dir/web/node_modules"

# ---- 删除环境文件 ----
echo "📄 [wt-teardown] 删除环境文件..."
rm -f "$target_dir/web/.env.development.local" "$target_dir/web/.env.local"

# ---- 删除工作区元数据 ----
echo "📦 [wt-teardown] 删除工作区元数据..."
rm -rf "$target_dir/.worktree"
