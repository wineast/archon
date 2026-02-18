## 项目知识

- 需求文档：`requirements/`
- 使用指南：`guide/`
- Issue 跟踪：`issues/`

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
- 常用命令统一使用 `make` 执行，所有可用 target 见 @Makefile
- 如果需要的 make target 不存在，先在 Makefile 中补充，再执行

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

### Template Engine（LiquidJS）
- 使用文档见 `guide/template-engine.md`
- 数据源：数据集（2 层 JSON）+ 工具定义
- 保留字：`tool`、`tool_names`、`tool_entries`

### Screenshots
- Playwright 截图统一存放到 `screenshots/` 目录（已 gitignore）
- 不要在项目根目录或其他位置随意放置截图文件

### Chat Persistence
- 非阻塞原则：用 Next.js `after()` 异步保存，绝不阻塞流式响应
- 正确：`Request → streamText → return → after() { save }`
- 错误：`Request → await save → streamText`（❌）

