#!/bin/bash
# 工作区环境重置（wt-setup 的反向操作）
# 用法: ./scripts/wt-reset.sh [target_dir]
#
# 流程: 删缓存/依赖 → 删数据库 → 删环境文件

set -e

target_dir="${1:-.}"

CONTAINER="archon-postgres"
DB_USER="archon"
DEFAULT_DB="archon"

# ---- 清理缓存和依赖 ----
echo "🗑️  [wt-reset] 清理构建缓存和依赖..."
rm -rf "$target_dir/web/.next" "$target_dir/web/node_modules"

# ---- 删除数据库 ----
echo "🗄️  [wt-reset] 删除数据库..."
cd "$target_dir"
if [ -f .worktree/meta.json ]; then
    wt_name=$(basename "$PWD")
    db_name="archon_$(echo "$wt_name" | tr '-' '_')"

    if docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DEFAULT_DB" -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$db_name'" 2>/dev/null | grep -q 1; then
        docker exec "$CONTAINER" dropdb -U "$DB_USER" "$db_name"
        echo "  Dropped database: $db_name"
    else
        echo "  Database $db_name does not exist"
    fi
fi

# ---- 删除环境文件 ----
echo "📄 [wt-reset] 删除环境文件..."
rm -f "$target_dir/web/.env.development.local" "$target_dir/web/.env.local"
