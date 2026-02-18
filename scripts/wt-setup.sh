#!/bin/bash
# 工作区环境初始化（供 make setup 和 worktree create 复用）
# 用法: ./scripts/wt-setup.sh [target_dir]
#
# 流程: link-env → db-local-env → npm install → db-push → db-seed

set -e

target_dir="${1:-.}"

# ---- link-env ----
echo "🔗 [env] 配置环境变量..."
if [ -f "$target_dir/web/.vercel/.env.development.local" ]; then
    ln -sf .vercel/.env.development.local "$target_dir/web/.env.local"
    echo "  Linked $target_dir/web/.env.local → .vercel/.env.development.local"
fi

# ---- db-local-env ----
CONTAINER="archon-postgres"
DB_USER="archon"
DEFAULT_DB="archon"

cd "$target_dir"
if [ -f .worktree/meta.json ]; then
    wt_name=$(basename "$PWD")
    db_name="archon_$(echo "$wt_name" | tr '-' '_')"
else
    db_name="$DEFAULT_DB"
fi

db_url="postgresql://$DB_USER:$DB_USER@localhost:5432/$db_name"

if [ "$db_name" != "$DEFAULT_DB" ]; then
    if ! docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DEFAULT_DB" -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1; then
        docker exec "$CONTAINER" createdb -U "$DB_USER" "$db_name"
        echo "  Created database: $db_name"
    fi
fi

printf 'DATABASE_URL=%s\nDATABASE_URL_UNPOOLED=%s\n' "$db_url" "$db_url" > web/.env.development.local
echo "  Created web/.env.development.local → local DB ($db_name)"

# ---- deps ----
echo "📥 [deps] 安装依赖..."
cd web && npm install

# ---- db-init ----
echo "🗄️  [db-init] 推送 schema..."
npm run db:push

echo "🌱 [db-init] 灌入种子数据..."
npm run db:seed
