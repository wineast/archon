#!/bin/bash
# 工作区数据初始化（推 schema + 灌种子）
# 用法: ./scripts/wt-init.sh [target_dir]
#
# 流程: db-push → db-seed

set -e

target_dir="${1:-.}"

echo "🗄️  [db-init] 推送 schema..."
cd "$target_dir/web"
npm run db:push

echo "🌱 [db-init] 灌入种子数据..."
npm run db:seed
