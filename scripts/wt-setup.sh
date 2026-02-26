#!/bin/bash
# 工作区静态环境初始化（供 make setup 和 worktree create 复用）
# 用法: ./scripts/wt-setup.sh [target_dir]
#
# 环境变量（可选，用于 worktree 自定义端口）:
#   WT_DEV_PORT, WT_SB_PORT, WT_STUDIO_PORT, WT_INNGEST_PORT, WT_BASE_BRANCH
#
# 流程: meta.json → link-env → db-local-env → npm install

set -e

target_dir="$(cd "${1:-.}" && pwd)"

# ---- meta.json ----
echo "📦 [meta] 创建工作区元数据..."
mkdir -p "$target_dir/.worktree"
meta_file="$target_dir/.worktree/meta.json"
# 默认值（环境变量可覆盖）
def_dev="${WT_DEV_PORT:-3000}"
def_sb="${WT_SB_PORT:-6006}"
def_studio="${WT_STUDIO_PORT:-4983}"
def_inngest="${WT_INNGEST_PORT:-8288}"
def_base="${WT_BASE_BRANCH:-main}"
if [ ! -f "$meta_file" ]; then
    # 首次创建
    node -e "
      var m={dev:$def_dev,storybook:$def_sb,studio:$def_studio,inngest:$def_inngest,baseBranch:'$def_base'};
      require('fs').writeFileSync('$meta_file',JSON.stringify(m)+'\n');
    "
    echo "  Created $meta_file"
else
    # 已存在 → 补缺字段（保留已有值，只补新增字段的默认值）
    node -e "
      var fs=require('fs');
      var m=JSON.parse(fs.readFileSync('$meta_file','utf8'));
      var defaults={dev:$def_dev,storybook:$def_sb,studio:$def_studio,inngest:$def_inngest,baseBranch:'$def_base'};
      var added=[];
      for(var k in defaults){if(m[k]===undefined){m[k]=defaults[k];added.push(k+'='+defaults[k]);}}
      fs.writeFileSync('$meta_file',JSON.stringify(m)+'\n');
      if(added.length)console.log('  Patched: '+added.join(', '));
      else console.log('  All fields present, no changes');
    "
fi

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

if [ -f "$target_dir/.worktree/meta.json" ]; then
    wt_name=$(basename "$target_dir")
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

printf 'DATABASE_URL=%s\nDATABASE_URL_UNPOOLED=%s\n' "$db_url" "$db_url" > "$target_dir/web/.env.development.local"

# 从主仓库继承非 DB 相关的环境变量（如 API_KEY_ENCRYPTION_SECRET）
# git worktree list 第一行始终是主仓库，无论从哪个 worktree 执行都能正确定位
project_root="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
source_env="$project_root/web/.env.development.local"
target_env="$target_dir/web/.env.development.local"
if [ -f "$source_env" ] && [ "$(realpath "$source_env")" != "$(realpath "$target_env")" ]; then
    grep -v -E '^(DATABASE_URL|DATABASE_URL_UNPOOLED)=' "$source_env" | grep -v '^[[:space:]]*$' >> "$target_env" || true
    echo "  Inherited extra env vars from main repo"
fi

# 追加 Inngest Dev Server 端口（worktree 场景下从 meta.json 读取）
if [ -f "$target_dir/.worktree/meta.json" ]; then
    inngest_port_val=$(node -p "require('$target_dir/.worktree/meta.json').inngest || ''" 2>/dev/null)
    if [ -n "$inngest_port_val" ]; then
        printf 'INNGEST_DEV=http://127.0.0.1:%s\n' "$inngest_port_val" >> "$target_env"
        echo "  Added INNGEST_DEV → port $inngest_port_val"
    fi
fi

echo "  Created web/.env.development.local → local DB ($db_name)"

# ---- deps ----
echo "📥 [deps] 安装依赖..."
cd "$target_dir/web" && npm install
