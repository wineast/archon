.PHONY: setup reset up down dev build lint typecheck test clean storybook db-generate db-migrate db-push db-push-force db-reset db-seed db-studio db-up db-down db-destroy db-neon-env db-init wt-list wt-create wt-sync wt-merge wt-delete wt-setup wt-reset

# ============================================================
# Setup
# ============================================================

## 项目初始化（clone 后执行一次）
setup:
	@echo "🔍 [vercel-check] 检查 Vercel 配置..."
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
	@echo "🐘 [db-up] 启动 Docker PostgreSQL..."
	@docker compose up -d --wait
	@echo "📦 [wt-meta] 创建工作区元数据..."
	@mkdir -p .worktree
	@if [ ! -f .worktree/meta.json ]; then \
		echo '{"dev":3000,"storybook":6006,"studio":4983,"baseBranch":"main"}' > .worktree/meta.json; \
		echo "  Created .worktree/meta.json (main workspace)"; \
	else \
		echo "  .worktree/meta.json 已存在，跳过"; \
	fi
	@./scripts/wt-setup.sh .
	@echo ""
	@echo "✅ Setup 完成"

## 反向清理
reset:
	@./scripts/wt-reset.sh .
	@echo "🐘 [reset] 停止 Docker 并删除数据卷..."
	docker compose down -v
	@echo "📦 [reset] 删除工作区元数据..."
	rm -rf .worktree
	@echo ""
	@echo "✅ Reset 完成"

# ============================================================
# Development
# ============================================================

## 启动所有开发服务（dev + storybook + db-studio）
up:
	@if [ -f .worktree/meta.json ]; then \
		DEV_PORT=$$(node -p "require('./.worktree/meta.json').dev") && \
		SB_PORT=$$(node -p "require('./.worktree/meta.json').storybook") && \
		STUDIO_PORT=$$(node -p "require('./.worktree/meta.json').studio") && \
		lsof -ti :$$DEV_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :$$SB_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :$$STUDIO_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		echo "🚀 启动服务 (dev=$$DEV_PORT, storybook=$$SB_PORT, studio=$$STUDIO_PORT)" && \
		(cd web && npm run dev -- --port $$DEV_PORT) & \
		(cd web && npm run storybook -- -p $$SB_PORT) & \
		(cd web && npx drizzle-kit studio --port $$STUDIO_PORT) & \
		wait; \
	else \
		lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :6006 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :4983 2>/dev/null | xargs kill 2>/dev/null || true; \
		echo "🚀 启动服务 (dev=3000, storybook=6006, studio=4983)" && \
		(cd web && npm run dev) & \
		(cd web && npm run storybook) & \
		(cd web && npm run db:studio) & \
		wait; \
	fi

## 停止所有开发服务
down:
	@if [ -f .worktree/meta.json ]; then \
		DEV_PORT=$$(node -p "require('./.worktree/meta.json').dev") && \
		SB_PORT=$$(node -p "require('./.worktree/meta.json').storybook") && \
		STUDIO_PORT=$$(node -p "require('./.worktree/meta.json').studio") && \
		lsof -ti :$$DEV_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :$$SB_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :$$STUDIO_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
	else \
		lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :6006 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :4983 2>/dev/null | xargs kill 2>/dev/null || true; \
	fi
	@echo "✅ 所有服务已停止"

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

db-seed:
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
	@echo "🐘 [db-up] 启动 Docker PostgreSQL..."
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

## 推 schema + 灌数据
db-init:
	@echo "🗄️  [db-init] 推送 schema..."
	@$(MAKE) db-push
	@echo "🌱 [db-init] 灌入种子数据..."
	@$(MAKE) db-seed

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

## 工作区环境初始化（用法: make wt-setup [DIR=.worktrees/xxx]）
wt-setup:
	@./scripts/wt-setup.sh $(or $(DIR),.)

## 工作区环境重置（用法: make wt-reset [DIR=.worktrees/xxx]）
wt-reset:
	@./scripts/wt-reset.sh $(or $(DIR),.)

