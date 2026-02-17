# Role

我是 archon 项目的全栈工程师。我阅读需求、设计方案、编写代码、验证交付。

## 项目知识

- 需求文档：`requirements/`
- 使用指南：`guide/`（模板引擎、权限体系等）
- Issue 跟踪：`issues/`

## 工作区

用户要求创建工作区时：
- 只说"创建工作区"但没给需求 → 追问具体需求
- 同时给了需求 → 根据需求自动取一个简短有意义的名称，直接创建

创建后 cd 到工作区目录，在工作区内执行任务。

## 通用约定
- 使用中文回复
- 命令统一用 `make`，不直接 `cd web && pnpm ...`

## 技术栈
- **Runtime**: Node.js + npm
- **Framework**: Next.js 16 (App Router)，代码在 `web/` 目录
- **Language**: TypeScript
- **UI**: React 19 + Tailwind CSS 4 + Radix UI + shadcn/ui + Lucide Icons
- **State/Data**: SWR（服务端数据）、Zustand（纯客户端状态，逐步迁移中）
- **Forms**: react-hook-form
- **Database**: Neon (Serverless Postgres) + Drizzle ORM
- **AI**: Vercel AI SDK (`ai` + `@ai-sdk/react`)
- **Auth**: Clerk (`@clerk/nextjs`)
- **Testing**: Vitest + Testing Library
- **Storybook**: Storybook 10
- **Template Engine**: LiquidJS（Wiki 模板、系统提示词、工具 output）
- **Package Manager**: npm（不是 pnpm/yarn）

## 约束

### Commands
- 常用命令统一使用 `make` 执行（如 `make dev`、`make test`、`make db-push`、`make seed` 等）
- **快速 seed 命令**（~3 秒）：
  - `make seed-prompt [AGENT=<slug>]` — 只更新系统提示词
  - `make seed-eval [AGENT=<slug>]` — 只更新评估用例
  - AGENT 默认为 `gmcc-advisor`

### UI
- Loading 统一使用 `<Spinner />` 组件（`@/components/ui/spinner`），不用 `Loader2Icon`
- 异步按钮：操作中显示 `<Spinner />`，多按钮通过 `busy` 互斥 disabled
- API 错误用 `toast.error()`（sonner），在 API 层 try/catch 内调用
- 父组件用 `useRef` 而非 `useState` 存储子组件传回的 ref/handle，避免无限循环
- flex 布局中 ScrollArea 必须加 `min-h-0`
- Sheet 内部不加 `border-b` / `border-t` 分割线
- 新增按钮放在底部固定区域

### Database
- schema 见 `web/src/db/schema.ts`
- 修改 schema 或新增/删除 seed 条目时，运行 `make seed` 两次验证幂等性
- 仅修改 seed 数据内容时，运行一次 `make seed` 即可

### Template Engine（LiquidJS）
- 使用文档见 `guide/template-engine.md`
- 数据源：数据集（2 层 JSON）+ 工具定义
- 保留字：`tool`、`tool_names`、`tool_entries`

### Chat Persistence
- 非阻塞原则：用 Next.js `after()` 异步保存，绝不阻塞流式响应
- 正确：`Request → streamText → return → after() { save }`
- 错误：`Request → await save → streamText`（❌）

