## 终极目标

Archon 是一个**母 Agent 平台** —— 通过对话式交互创建、配置、部署子 Agent，让不写代码的人也能快速落地 AI 应用。

### 商业模式

- 招聘 **FDA（前端部署工程师）** 分布全国各城市，驻场/远程服务传统企业及已有数字化基础的企业
- FDA 懂业务、不碰代码，在 Archon 上通过对话 + 查看用例效果来配置 Agent，以结果为导向
- 定制的 Agent 与企业内部数据系统打通，解决实际业务问题

### 数据打通

- **API 调用**：企业暴露 API，Archon 工具系统对接
- **宿主通信**：嵌入企业前端页面，通过 host postMessage 双向打通

### 交付形态（全覆盖）

- 线上 SaaS —— URL 直接访问
- 嵌入宿主系统 —— embed widget
- 私有化部署

### 收费模型（分阶段）

1. 早期：FDA 人天服务费（卖服务）
2. 中期：+ 按 Agent 数量收费（卖平台）
3. 后期：+ 按对话 / Token 用量收费（卖用量）

### 产品推论

当前工具编辑、组件 JSX、LiquidJS 模板等面向开发者的界面是底层能力，后续需要在其上构建一层**对话式 Agent 配置体验**，让 FDA 无需理解底层实现即可完成 Agent 搭建。

---

## 项目知识

- 功能树：`features/README.md`
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
- 当前为开发阶段，schema 变更直接用 `make db-push`，不要生成迁移文件
- 如果 `db-push` 遇到交互式确认（如破坏性变更），直接用 `make db-reset` 重建

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

### 测试账号

| 邮箱 | 密码 |
|------|------|
| yarnb@qq.com | archon123456Aa. |

