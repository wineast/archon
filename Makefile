.PHONY: dev build lint typecheck test clean install storybook db-generate db-migrate db-push db-push-force db-reset db-seed seed seed-prompt seed-eval seed-chat seed-vars seed-tools seed-wiki seed-lookup seed-data-object db-studio wt-list wt-create wt-delete wt-rm wt-merge

# ============================================================
# Development
# ============================================================

dev:
	@if [ -f .worktree/port.json ]; then \
		export DEV_PORT=$$(node -p "require('./.worktree/port.json').dev") && \
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
	@if [ -f .worktree/port.json ]; then \
		export SB_PORT=$$(node -p "require('./.worktree/port.json').storybook") && \
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

seed-prompt:
	cd web && npm run db:seed-prompt -- $(AGENT)

seed-eval:
	cd web && npm run db:seed-eval -- $(AGENT)

seed-chat:
	cd web && npm run db:seed-chat -- $(AGENT)

seed-vars:
	cd web && npm run db:seed-vars -- $(AGENT)

seed-tools:
	cd web && npm run db:seed-tools -- $(AGENT)

seed-wiki:
	cd web && npm run db:seed-wiki -- $(AGENT)

seed-lookup:
	cd web && npm run db:seed-lookup -- $(AGENT)

seed-data-object:
	cd web && npm run db:seed-data-object -- $(AGENT)

db-studio:
	cd web && npm run db:studio

# ============================================================
# Git Worktree
# ============================================================

## 列出所有 worktree
wt-list:
	@./.claude/skills/worktree/scripts/worktree.sh list

## 创建 worktree（用法: make wt-create NAME=feature-xxx [BASE=main] [CD=1]）
## 加 CD=1 后配合 eval 使用: eval "$(make wt-create NAME=xxx CD=1)"
wt-create:
ifdef CD
	@./.claude/skills/worktree/scripts/worktree.sh create $(NAME) $(BASE) >&2
	@echo "cd $(CURDIR)/.worktrees/$(NAME)"
else
	@./.claude/skills/worktree/scripts/worktree.sh create $(NAME) $(BASE)
endif

## 删除 worktree（用法: make wt-delete NAME=feature-xxx）
wt-delete:
	@./.claude/skills/worktree/scripts/worktree.sh delete $(NAME)

## 交互式选择删除 worktree
wt-rm:
	@./.claude/skills/worktree/scripts/worktree.sh select-delete

## 合并 worktree 到 main（用法: make wt-merge NAME=feature-xxx）
wt-merge:
	@if [ -z "$(NAME)" ]; then \
		echo "请指定工作区: make wt-merge NAME=<name>"; \
		exit 1; \
	fi && \
	WT_DIR="$(CURDIR)/.worktrees/$(NAME)" && \
	if [ ! -d "$$WT_DIR" ]; then \
		echo "工作区不存在: $(NAME)"; \
		exit 1; \
	fi && \
	BRANCH=$$(git -C "$$WT_DIR" rev-parse --abbrev-ref HEAD) && \
	echo "合并 $$BRANCH → main ..." && \
	git merge "$$BRANCH" && \
	echo "已合并 $$BRANCH 到 main"
