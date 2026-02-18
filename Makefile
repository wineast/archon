.PHONY: setup wt-init wt-meta env deps vercel-check dev build lint typecheck test clean storybook db-generate db-migrate db-push db-push-force db-reset db-seed seed db-studio db-up db-down db-destroy db-neon-env db-drop db-init wt-list wt-create wt-sync wt-merge wt-delete

# ============================================================
# Setup
# ============================================================

## 项目初始化（clone 后执行一次）
## 检查 vercel → 启动 Docker → 创建主仓库 meta → wt-init
setup: vercel-check db-up wt-meta wt-init

## 工作区初始化（setup 和 wt-create 共用）
## env (link-env + db-local-env) → deps (npm install) → db-init (push + seed)
wt-init: env deps db-init

## 创建主仓库的 .worktree/meta.json（把主仓库也视为工作区）
wt-meta:
	@mkdir -p .worktree
	@if [ ! -f .worktree/meta.json ]; then \
		echo '{"dev":3000,"storybook":6006,"baseBranch":"main"}' > .worktree/meta.json; \
		echo "Created .worktree/meta.json (main workspace)"; \
	fi

## 环境配置：创建 .env.local symlink + .env.development.local（指向正确数据库）
env:
	@./scripts/link-env.sh
	@./scripts/db-local-env.sh

## 安装依赖
deps:
	cd web && npm install

vercel-check:
	@if [ ! -d web/.vercel ]; then \
		echo ""; \
		echo "========================================"; \
		echo "  web/.vercel 不存在，请先手动执行:"; \
		echo ""; \
		echo "  cd web && npx vercel link && npx vercel pull"; \
		echo ""; \
		echo "  完成后重新运行 make setup"; \
		echo "========================================"; \
		echo ""; \
		exit 1; \
	fi

# ============================================================
# Development
# ============================================================

dev:
	@if [ -f .worktree/meta.json ]; then \
		export DEV_PORT=$$(node -p "require('./.worktree/meta.json').dev") && \
		lsof -ti :$$DEV_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		echo "Port: dev=$$DEV_PORT" && \
		cd web && npm run dev -- --port $$DEV_PORT; \
	else \
		lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true; \
		cd web && npm run dev; \
	fi

build:
	cd web && npm run build

lint:
	cd web && npm run lint

typecheck:
	cd web && npx tsc --noEmit

test:
	cd web && npm test

storybook:
	@if [ -f .worktree/meta.json ]; then \
		export SB_PORT=$$(node -p "require('./.worktree/meta.json').storybook") && \
		lsof -ti :$$SB_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		echo "Port: storybook=$$SB_PORT" && \
		cd web && npm run storybook -- -p $$SB_PORT; \
	else \
		lsof -ti :6006 2>/dev/null | xargs kill 2>/dev/null || true; \
		cd web && npm run storybook; \
	fi

clean:
	rm -rf web/.next web/node_modules

# ============================================================
# Database
# ============================================================

db-generate:
	cd web && npm run db:generate

db-migrate:
	cd web && npm run db:migrate

db-push:
	cd web && npm run db:push

db-push-force:
	cd web && npx drizzle-kit push --force

db-reset:
	cd web && npm run db:reset

db-seed seed:
	cd web && npm run db:seed

db-studio:
	@if [ -f .worktree/meta.json ]; then \
		export STUDIO_PORT=$$(node -p "require('./.worktree/meta.json').studio") && \
		lsof -ti :$$STUDIO_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		echo "Port: studio=$$STUDIO_PORT" && \
		cd web && npx drizzle-kit studio --port $$STUDIO_PORT; \
	else \
		lsof -ti :4983 2>/dev/null | xargs kill 2>/dev/null || true; \
		cd web && npm run db:studio; \
	fi

# ============================================================
# Docker PostgreSQL
# ============================================================

## 启动本地 Docker PostgreSQL
db-up:
	docker compose up -d --wait

## 停止容器
db-down:
	docker compose down

## 停止并删除数据卷
db-destroy:
	docker compose down -v

## 切回 Neon 云 DB（删除覆盖文件，.env.local 恢复生效）
db-neon-env:
	@rm -f web/.env.development.local && \
	echo "Removed web/.env.development.local → Neon DB"

## 删除当前工作区的独立数据库
db-drop:
	@./scripts/db-drop.sh

## 推 schema + 灌数据
db-init: db-push seed

# ============================================================
# Git Worktree
# ============================================================

## 列出所有 worktree
wt-list:
	@./.claude/skills/worktree/scripts/worktree.sh list

## 创建 worktree（用法: make wt-create NAME=feature-xxx [BASE=main]）
wt-create:
	@./.claude/skills/worktree/scripts/worktree.sh create $(NAME) $(BASE)

## 同步上游分支到当前工作区
wt-sync:
	@./.claude/skills/worktree/scripts/worktree.sh sync

## 合并工作区回 base 分支（用法: make wt-merge NAME=feature-xxx）
wt-merge:
	@./.claude/skills/worktree/scripts/worktree.sh merge $(NAME)

## 删除 worktree（用法: make wt-delete NAME=feature-xxx）
wt-delete:
	@./.claude/skills/worktree/scripts/worktree.sh delete $(NAME)

