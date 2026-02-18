#!/bin/bash
# 创建/切换到本地 Docker DB 环境
# 在 worktree 中自动创建独立数据库

set -e

CONTAINER="archon-postgres"
DB_USER="archon"
DEFAULT_DB="archon"

# 判断是否在 worktree 中
if [ -f .worktree/meta.json ]; then
    wt_name=$(basename "$PWD")
    db_name="archon_$(echo "$wt_name" | tr '-' '_')"
else
    db_name="$DEFAULT_DB"
fi

db_url="postgresql://$DB_USER:$DB_USER@localhost:5432/$db_name"

# 如果是独立数据库（非主库），确保数据库存在
if [ "$db_name" != "$DEFAULT_DB" ]; then
    if ! docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DEFAULT_DB" -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1; then
        docker exec "$CONTAINER" createdb -U "$DB_USER" "$db_name"
        echo "Created database: $db_name"
    fi
fi

# 写入 env 文件
printf 'DATABASE_URL=%s\nDATABASE_URL_UNPOOLED=%s\n' "$db_url" "$db_url" > web/.env.development.local
echo "Created web/.env.development.local → local DB ($db_name)"
