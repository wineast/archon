#!/bin/bash
# 删除当前工作区的独立数据库

set -e

CONTAINER="archon-postgres"
DB_USER="archon"
DEFAULT_DB="archon"

if [ ! -f .worktree/meta.json ]; then
    echo "Not in a worktree"
    exit 1
fi

wt_name=$(basename "$PWD")
db_name="archon_$(echo "$wt_name" | tr '-' '_')"

if docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DEFAULT_DB" -tc \
    "SELECT 1 FROM pg_database WHERE datname = '$db_name'" 2>/dev/null | grep -q 1; then
    docker exec "$CONTAINER" dropdb -U "$DB_USER" "$db_name"
    echo "Dropped database: $db_name"
else
    echo "Database $db_name does not exist"
fi
