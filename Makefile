.PHONY: dev build lint typecheck test clean install storybook db-generate db-migrate db-push db-push-force db-reset db-seed seed db-studio wt-list wt-create wt-merge wt-delete

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
	cd web && npm run db:studio

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

