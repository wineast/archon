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

### 核心价值

**对企业客户**：痛点不是缺 AI 工具，而是不知道怎么用到自己业务里。FDA 是桥梁——懂业务场景、能梳理需求、用 Archon 快速出效果。比企业自己招 AI 工程师便宜，比找外包公司快。

**对平台方**：中国 to B 市场企业不为"工具"付费，为"解决问题"付费。FDA 人天服务费是进门票，每部署一个 Agent 多一个持续收费节点，每个 Agent 跑起来 token 用量就是持续现金流。**服务拉动平台，平台产生用量**，三层叠加。

**护城河**：Dify 们只有工具没有落地能力，Archon 的模式是**工具 + 人 + 场景**——FDA 网络是分发渠道抄不走，每次部署积累的行业模板和集成 pattern 沉淀回平台让下次更快，母 Agent 越用越聪明。

### 产品推论

当前工具编辑、组件 JSX、LiquidJS 模板等面向开发者的界面是底层能力，后续需要在其上构建一层**对话式 Agent 配置体验**，让 FDA 无需理解底层实现即可完成 Agent 搭建。

---

## 项目知识

- 使用指南：`guide/`（唯一 source of truth，需求/问题/功能全部通过 guide 文档驱动；被代码 import 的文档保留在 `web/guide/`）

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

### Forms（react-hook-form）
- 所有表单必须使用 react-hook-form，采用**非受控模式**以保证大表单/动态列表场景零卡顿
- 优先用 `register()` 绑定原生 input；仅在需要自定义组件（Select、Switch、Checkbox 等）时使用 `Controller`
- 动态列表用 `useFieldArray`，禁止手动 `setValue` 拼索引来增删项
- 局部订阅用 `useWatch({ name })`，不要 `watch()` 全量订阅——避免整棵表单树重渲染
- 脏值检测：用 deep equal（如 `fast-deep-equal`）对比 `originalRef` 与 `form.getValues()`，不要用 `JSON.stringify` 比较（属性插入顺序不同会导致假阳性）；服务端数据刷新时必须同步 `originalRef` + `form.reset()` + 通知 dirty=false
- 子表单通过 `useFormContext()` 获取同一个 form 实例，不要 props 透传 form 对象
- 深层嵌套组件拆分为独立组件 + 独立 `useWatch`，让 React 只重渲染真正变化的子树
- 禁止在 `onChange` 回调中调用 `setState` 来镜像表单值——这会造成双重渲染且破坏非受控模式

### UI
- Loading 统一使用 `<Spinner />` 组件（`@/components/ui/spinner`），不用 `Loader2Icon`
- 异步按钮：操作中显示 `<Spinner />`，多按钮通过 `busy` 互斥 disabled
- API 错误用 `toast.error()`（sonner），在 API 层 try/catch 内调用
- 父组件用 `useRef` 而非 `useState` 存储子组件传回的 ref/handle，避免无限循环
- flex 布局中 ScrollArea 必须加 `min-h-0`
- ScrollArea 内容横向溢出：Radix ScrollArea 的 Viewport 内部会自动生成一个 `display: table; min-width: 100%` 的包装 div，导致子内容可以无限水平扩展（`truncate` 失效）。修复方法：在 ScrollArea 上加 `[&_[data-slot=scroll-area-viewport]>div]:!block` 强制覆盖为 `display: block`
- Sheet 内部不加 `border-b` / `border-t` 分割线
- 新增按钮放在底部固定区域
- Edit/Preview 切换统一使用 Radix `<Tabs>` 组件，禁止用 Button 自行实现模式切换——详见 `guide/edit-preview-pattern.md`。表单内嵌的 default variant Tabs 统一小尺寸：`TabsList` 加 `h-7`、`TabsTrigger` 加 `text-xs`、`Tabs` 与上方 label 间距用 `mt-1`；`variant="line"` 的导航级 Tabs 保持默认尺寸
- 详情页底部操作栏统一样式：容器 `flex items-center gap-2 border-t px-4 py-2`；Save 按钮带 `SaveIcon` + "Saving..." 文字切换；Reset 按钮 `variant="ghost"` 带 `RotateCcwIcon`；Delete 按钮 `variant="destructive"` 用 `flex-1` 隔开靠右，带 "Deleting..." 文字切换
- 代码预览统一使用 CodeMirror 只读编辑器（`readOnly`）：JS/TS 用 `JsEditor`，JSON 用 `JsonEditor`，不用 `CodeBlockContent`（shiki）或 `<pre>` 标签。固定高度（如 `height="400px"`）启用内部滚动，不要 `height="auto"` 导致无限撑高
- 工具栏中 Copy/Export 等辅助按钮用 `size="icon" variant="ghost"` 只显示图标，不加文字，保持紧凑

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

### 收尾检查
- 代码修改完成后，必须依次执行 `make typecheck` 和 `make test`，确认类型无报错 + 测试通过后才算任务完成
- 同步 `guide/` 使用指南：根据本次改动内容，对 `guide/` 目录下的相关文档执行 CRUD——新增功能写新文档或新章节，修改功能更新对应段落，删除功能移除过时描述，确保文档与代码始终一致

### 测试账号

| 邮箱 | 密码 |
|------|------|
| yarnb@qq.com | archon123456Aa. |

