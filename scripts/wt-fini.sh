#!/bin/bash
# 工作区数据清理（wt-init 的反向操作）
# 用法: ./scripts/wt-fini.sh [target_dir]
#
# 流程: 删数据库

set -e

target_dir="${1:-.}"

CONTAINER="archon-postgres"
DB_USER="archon"
DEFAULT_DB="archon"

echo "🗄️  [wt-fini] 删除数据库..."
cd "$target_dir"
if [ -f .worktree/meta.json ]; then
    wt_name=$(basename "$PWD")
    db_name="archon_$(echo "$wt_name" | tr '-' '_')"

    if docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DEFAULT_DB" -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$db_name'" 2>/dev/null | grep -q 1; then
        # 先终止所有到该数据库的活跃连接，否则 dropdb 会失败
        docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DEFAULT_DB" -c \
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db_name' AND pid <> pg_backend_pid();" \
            >/dev/null 2>&1 || true
        docker exec "$CONTAINER" dropdb -U "$DB_USER" "$db_name"
        echo "  Dropped database: $db_name"
    else
        echo "  Database $db_name does not exist"
    fi
fi
