.PHONY: setup teardown up down restart restart-dev restart-storybook restart-studio dev build lint typecheck test e2e e2e-ui e2e-eval e2e-eval-binary clean storybook deps db-generate db-migrate db-push db-push-force db-reset db-seed db-studio db-up db-down db-destroy db-neon-env db-init wt-list wt-create wt-sync wt-merge wt-delete wt-setup wt-teardown wt-init wt-fini fixture-zip

# ============================================================
# Setup
# ============================================================

## 项目初始化（clone 后执行一次）
setup:
	@echo "🔗 [git-hooks] 配置 git hooks..."
	@git config core.hooksPath .githooks
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
	@docker info >/dev/null 2>&1 || { echo "❌ Docker 未运行，请先启动 Docker Desktop"; exit 1; }
	@$(MAKE) db-up
	@$(MAKE) wt-setup
	@$(MAKE) wt-init
	@echo ""
	@echo "✅ Setup 完成"

## 反向清理
teardown:
	@$(MAKE) wt-fini
	@$(MAKE) wt-teardown
	@echo "🐘 [teardown] 停止 Docker 并删除数据卷..."
	@docker compose down -v 2>/dev/null || echo "  Docker 未运行，跳过"
	@echo ""
	@echo "✅ Teardown 完成"

# ============================================================
# Development
# ============================================================

LOG_DIR := .logs

## 启动所有开发服务（db + dev + storybook + db-studio），日志输出到 .logs/
up: db-up
	@mkdir -p $(LOG_DIR)
	@if [ -f .worktree/meta.json ]; then \
		DEV_PORT=$$(node -p "require('./.worktree/meta.json').dev") && \
		SB_PORT=$$(node -p "require('./.worktree/meta.json').storybook") && \
		STUDIO_PORT=$$(node -p "require('./.worktree/meta.json').studio") && \
		lsof -ti :$$DEV_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :$$SB_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :$$STUDIO_PORT 2>/dev/null | xargs kill 2>/dev/null || true; \
		echo "" && \
		echo "🚀 启动服务..." && \
		echo "📄 日志: $(LOG_DIR)/{dev,storybook,studio}.log" && \
		echo "" && \
		echo "  Dev Server   → http://localhost:$$DEV_PORT" && \
		echo "  Storybook    → http://localhost:$$SB_PORT" && \
		echo "  DB Studio    → https://local.drizzle.studio?port=$$STUDIO_PORT" && \
		echo "  Embed Test   → http://localhost:$$DEV_PORT/embed/test.html" && \
		echo "" && \
		(cd web && npm run dev -- --port $$DEV_PORT) > $(LOG_DIR)/dev.log 2>&1 & \
		(cd web && npm run storybook -- -p $$SB_PORT) > $(LOG_DIR)/storybook.log 2>&1 & \
		(cd web && npx drizzle-kit studio --port $$STUDIO_PORT) > $(LOG_DIR)/studio.log 2>&1 & \
		wait; \
	else \
		lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :6006 2>/dev/null | xargs kill 2>/dev/null || true; \
		lsof -ti :4983 2>/dev/null | xargs kill 2>/dev/null || true; \
		echo "" && \
		echo "🚀 启动服务..." && \
		echo "📄 日志: $(LOG_DIR)/{dev,storybook,studio}.log" && \
		echo "" && \
		echo "  Dev Server   → http://localhost:3000" && \
		echo "  Storybook    → http://localhost:6006" && \
		echo "  DB Studio    → https://local.drizzle.studio" && \
		echo "  Embed Test   → http://localhost:3000/embed/test.html" && \
		echo "" && \
		(cd web && npm run dev) > $(LOG_DIR)/dev.log 2>&1 & \
		(cd web && npm run storybook) > $(LOG_DIR)/storybook.log 2>&1 & \
		(cd web && npm run db:studio) > $(LOG_DIR)/studio.log 2>&1 & \
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

## 安装依赖
deps:
	cd web && npm install

build:
	cd web && npm run build

lint:
	cd web && npm run lint

typecheck:
	cd web && npx tsc --noEmit

test:
	cd web && npm test

e2e:
	cd web && npx playwright test

e2e-ui:
	cd web && npx playwright test --ui

e2e-eval:
	cd web && npx playwright test --project=eval

e2e-eval-binary:
	cd web && npx playwright test --project=eval eval-binary

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

## 重启所有开发服务
restart: down up

## 重启 dev server
restart-dev: dev

## 重启 storybook
restart-storybook: storybook

## 重启 drizzle studio
restart-studio: db-studio

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

## 启动本地 Docker PostgreSQL（始终使用主仓库的 compose 文件，worktree 共享同一容器）
db-up:
	@echo "🐘 [db-up] 启动 Docker PostgreSQL..."
	docker compose -f "$$(git worktree list --porcelain | head -1 | sed 's/worktree //')/docker-compose.yml" up -d --wait

## 停止容器
db-down:
	docker compose -f "$$(git worktree list --porcelain | head -1 | sed 's/worktree //')/docker-compose.yml" down

## 停止并删除数据卷
db-destroy:
	docker compose -f "$$(git worktree list --porcelain | head -1 | sed 's/worktree //')/docker-compose.yml" down -v

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
	@./scripts/worktree.sh list

## 创建 worktree（用法: make wt-create NAME=feature-xxx [BASE=main]）
wt-create:
	@./scripts/worktree.sh create $(NAME) $(BASE)

## 同步上游分支到当前工作区
wt-sync:
	@./scripts/worktree.sh sync

## 合并工作区回 base 分支（用法: make wt-merge NAME=feature-xxx）
wt-merge:
	@./scripts/worktree.sh merge $(NAME)

## 删除 worktree（用法: make wt-delete NAME=feature-xxx）
wt-delete:
	@./scripts/worktree.sh delete $(NAME)

## 工作区静态环境初始化（link-env + db-local-env + npm install）
wt-setup:
	@./scripts/wt-setup.sh $(or $(DIR),.)

## 工作区静态环境清理（wt-setup 的反向）
wt-teardown:
	@./scripts/wt-teardown.sh $(or $(DIR),.)

## 工作区数据初始化（db-push + seed）
wt-init:
	@./scripts/wt-init.sh $(or $(DIR),.)

## 工作区数据清理（wt-init 的反向）
wt-fini:
	@./scripts/wt-fini.sh $(or $(DIR),.)

# ============================================================
# Fixtures
# ============================================================

## 将 data/fixtures/ 下的文件夹打包为 ZIP（用法: make fixture-zip NAME=gmcc-advisor）
fixture-zip:
	@if [ -z "$(NAME)" ]; then echo "用法: make fixture-zip NAME=<folder-name>"; exit 1; fi
	@DIR="data/fixtures/$(NAME)"; \
	if [ ! -d "$$DIR" ]; then echo "❌ $$DIR 不存在"; exit 1; fi; \
	OUT="data/fixtures/$(NAME).zip"; \
	if [ -f "$$OUT" ]; then \
		V=1; while [ -f "data/fixtures/$(NAME).v$$V.zip" ]; do V=$$((V+1)); done; \
		mv "$$OUT" "data/fixtures/$(NAME).v$$V.zip"; \
		echo "📦 已有 zip 重命名为 $(NAME).v$$V.zip"; \
	fi; \
	(cd "$$DIR" && zip -r "../$(NAME).zip" .) && \
	echo "✅ $$OUT ($$(du -h "$$OUT" | cut -f1))"

