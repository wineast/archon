.PHONY: dev build lint typecheck test clean install storybook db-generate db-migrate db-push db-push-force db-reset db-seed seed db-studio db-up db-down db-destroy db-local-env db-neon-env db-local-setup wt-list wt-create wt-merge wt-delete

# ============================================================
# Development
# ============================================================

dev:
	@if [ -f .worktree/meta.json ]; then \
		export DEV_PORT=$$(node -p "require('./.worktree/meta.json').dev") && \
		echo "Port: dev=$$DEV_PORT" && \
		cd web && npm run dev -- --port $$DEV_PORT; \
	else \
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
		echo "Port: storybook=$$SB_PORT" && \
		cd web && npm run storybook -- -p $$SB_PORT; \
	else \
		cd web && npm run storybook; \
	fi

clean:
	rm -rf web/.next web/node_modules

install:
	cd web && npm install

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
		echo "Port: studio=$$STUDIO_PORT" && \
		cd web && npx drizzle-kit studio --port $$STUDIO_PORT; \
	else \
		cd web && npm run db:studio; \
	fi

# ============================================================
# Docker PostgreSQL
# ============================================================

LOCAL_DB_URL := postgresql://archon:archon@localhost:5432/archon

## 启动本地 Docker PostgreSQL
db-up:
	docker compose up -d --wait

## 停止容器
db-down:
	docker compose down

## 停止并删除数据卷
db-destroy:
	docker compose down -v

## 切换到本地 Docker DB（创建 .env.development.local 覆盖 .env.local）
db-local-env:
	@printf 'DATABASE_URL=$(LOCAL_DB_URL)\nDATABASE_URL_UNPOOLED=$(LOCAL_DB_URL)\n' > web/.env.development.local && \
	echo "Created web/.env.development.local → local DB"

## 切回 Neon 云 DB（删除覆盖文件，.env.local 恢复生效）
db-neon-env:
	@rm -f web/.env.development.local && \
	echo "Removed web/.env.development.local → Neon DB"

## 一键设置本地 DB（启动 → 切换环境 → 推送 schema → 播种数据）
db-local-setup: db-up db-local-env db-push seed

# ============================================================
# Git Worktree
# ============================================================

## 列出所有 worktree
wt-list:
	@./.claude/skills/worktree/scripts/worktree.sh list

## 创建 worktree（用法: make wt-create NAME=feature-xxx [BASE=main]）
wt-create:
	@./.claude/skills/worktree/scripts/worktree.sh create $(NAME) $(BASE)

## 合并工作区回 base 分支（用法: make wt-merge NAME=feature-xxx）
wt-merge:
	@./.claude/skills/worktree/scripts/worktree.sh merge $(NAME)

## 删除 worktree（用法: make wt-delete NAME=feature-xxx）
wt-delete:
	@./.claude/skills/worktree/scripts/worktree.sh delete $(NAME)

