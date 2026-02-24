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

- 使用指南：`web/guide/`（唯一 source of truth，需求/问题/功能全部通过 guide 文档驱动）
- 当前为 **beta 阶段**，优先保证正确的设计，不考虑向后兼容

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
- 表单 label 统一样式：`text-xs font-medium text-muted-foreground`，label 与控件间距用 `mt-1`
- Edit/Preview 切换统一使用 Radix `<Tabs>` 组件，禁止用 Button 自行实现模式切换——详见 `web/guide/edit-preview-pattern.md`。表单内嵌的 default variant Tabs 统一小尺寸：`TabsList` 加 `h-7`、`TabsTrigger` 加 `text-xs`、`Tabs` 与上方 label 间距用 `mt-1`；`variant="line"` 的导航级 Tabs 保持默认尺寸
- 详情页底部操作栏统一样式：容器 `flex items-center gap-2 border-t px-4 py-2`；Save 按钮带 `SaveIcon` + "Saving..." 文字切换；Reset 按钮 `variant="ghost"` 带 `RotateCcwIcon` + "Reset" 文字；Delete 按钮 `variant="destructive"` 用 `flex-1` 隔开靠右，带 "Deleting..." 文字切换；多个异步按钮通过 `busy` 变量互斥 disabled
- 详情页底部操作栏 Switch 开关：有开关语义的资源在最左侧放 `<Switch className="scale-75" />` + 状态文字（`text-xs text-muted-foreground`），包裹在 `flex items-center gap-1.5` 容器中。根据数据语义区分两种：
  - **启用型**（`enabled` 字段，如 Tool、Skill、MCP Server）：文字 "Enabled" / "Disabled"，双向可切换
  - **激活型**（`isActive` 字段，如 Model Config、Judge Config）：文字 "Active" / "Inactive"，同组只能有一个 active，已激活时 Switch `disabled`（不可手动关闭，需激活其他配置来替换）
- **弹窗（Dialog/Sheet）表单只放 Cancel + Primary Action 两个按钮**，禁止加 Reset 按钮——关闭弹窗本身即放弃修改，Reset 在弹窗场景下多余且增加认知负担。Reset 仅用于常驻详情页底部操作栏
- 代码预览统一使用 Monaco 只读编辑器（`readOnly`）：JS/TS 用 `JsEditor`，JSON 用 `JsonEditor`，不用 `CodeBlockContent`（shiki）或 `<pre>` 标签。固定高度（如 `height="400px"`）启用内部滚动，不要 `height="auto"` 导致无限撑高
- 工具栏中 Copy/Export 等辅助按钮用 `size="icon" variant="ghost"` 只显示图标，不加文字，保持紧凑
- 编辑区 label 行辅助按钮顺序：`Label` → `GuideDialog(?)` → `AI 编辑`——信息参考紧跟 label，操作按钮放最后
- 模块开关（Skills、MCP Servers、Memory 等可整体启用/禁用的功能模块）统一交互模式：
  - **侧边栏 header**：使用 `<Switch className="scale-75" />`，放在 header 右侧、新增按钮左侧
  - **Switch 行为**：纯控运行时开关，直接切换，无需确认弹窗
  - **首次仪式页**：仅当 `!enabled && 无数据`（如 skills.length===0、config===null、mcpServers.length===0）时展示居中布局：模块图标（`size-12 opacity-30`）+ "XX 功能未启用" 文字 + `variant="outline"` 启用按钮（带 `PowerIcon`），容器 `gap-4`；按钮加 `<Spinner />` loading 态
  - **有数据时**：即使 Switch 关闭，也显示完整 UI（可编辑），Switch 仅控制运行时是否生效

### Storybook
- Story 的 `name` 字段统一使用中文，如 `name: "基础示例"`、`name: "交互演示"`
- export 变量名保持英文驼峰（`export const Basic: Story`），仅通过 `name` 属性控制侧边栏显示名

### Database
- schema 见 `web/src/db/schema.ts`
- **工作区（worktree）开发**：只用 `make db-push` 快速迭代，不生成迁移文件——因为工作区并行导致迁移生成顺序不固定
- **上游分支（dev/main）**：schema 变更从工作区合并后，统一 `make db-generate` 生成迁移文件并提交
- **生产部署**：只用 `make db-migrate`，禁止 `db-push`——迁移文件是上线唯一通道
- 如果 `db-push` 遇到交互式确认（如破坏性变更），直接用 `make db-reset` 重建
- 详见 `web/guide/production-database.md`
- **查询版本化资源（tools、functions、components、datasets、wiki、schemas 等）时必须加 `versionId` 过滤**——这些资源按 version 隔离，缺少 `versionId` 条件会导致跨 Agent/跨版本数据混入。标准模式：`eq(table.versionId, versionId)` + 其他条件（如 `eq(table.enabled, true)`, `isNull(table.deletedAt)`）

### 资源共享池
- **所有资源都必须存在于数据库中**，禁止前端硬编码资源列表（如 `BUILTIN_FUNCTIONS`、`BUILTIN_COMPONENTS` 常量）
- 内置资源（如 system tools、compileExpression、Badge/Spinner/Table/Tooltip）必须作为 `origin: "builtin"` 的池资源存入数据库
- Agent 使用池资源需要通过 `agentResourceRefs` 引用并启用，不会自动出现在 Agent 的资源列表中
- 资源来源（origin）三种：`builtin`（系统内置）、`user`（用户创建）、`marketplace`（市场下载，预留）
- 共享池支持 7 种资源类型：tool、component、function、dataset、wiki、schema、mcp-server
- **Builtin 资源的运行时与资源管理分离**：
  - 运行时注入（如 `BASE_DEPS`、`archon:ui` 模块）通过 **key** 与 DB 池资源匹配
  - `agentResourceRefs.enabled` 仅对 **tool** 有意义（控制工具启用/禁用，影响运行时）；function、component 等其他资源类型的 `enabled` 字段为预留，不影响运行时
- **池引用详情视图规则**：
  - 池引用（不论 origin）的资源定义字段全部**只读**，不可编辑——表单字段 disabled，隐藏 Save/Delete
  - 引用层面的控制：移除引用按钮；enabled 开关仅对 tool 类型显示
  - Builtin 资源额外隐藏不适用的编辑区域（Tool 隐藏 handler/执行环境，Function 隐藏 code 编辑器，Component 隐藏 JSX/CSS 编辑器）
  - 顶部显示来源 badge（`系统内置` / `共享池`）说明为何不可编辑

### Tailwind CSS 4 响应式变体陷阱
- Next.js dev 模式会将 CSS 拆成多个 chunk（外部 CSS + inline `<style>` 块），导致同一个 utility class（如 `.text-center`）被重复生成在不同的 style 块中，后出现的会覆盖前面的响应式变体（如 `sm:text-left`），破坏层叠顺序
- Production build 不受影响（单文件，无重复）
- **修复方式**：响应式覆盖需加 `!important`，如 `sm:!text-left`，确保 dev/prod 两种模式都能正确工作

### Template Engine（LiquidJS）
- 使用文档见 `web/guide/template-engine.md`
- 数据源：数据集（2 层 JSON）+ 工具定义
- 保留字：`tool`、`tool_names`、`tool_entries`
- **编辑器补全 ↔ 预览渲染一致性**：每种模板编辑场景的补全提示和预览渲染必须注入相同的变量集。数据集 data 只注入前序数据集，不注入内置变量（`date`/`time` 等）和 tool/ontology；系统提示词注入全部变量

### Screenshots
- Playwright 截图统一存放到 `screenshots/` 目录（已 gitignore）
- 不要在项目根目录或其他位置随意放置截图文件

### E2E 测试（Playwright）
- 选择器统一使用 `data-testid`，不依赖文本内容（因为有中英文 locale 切换）
- **先手动验证，再写测试**：编写 E2E 测试前，必须先用 Playwright MCP 工具（`mcp__playwright__*`）手动走一遍完整流程，确认每一步的实际 DOM 结构和选择器都能正常工作，跑通后再编写测试代码。测试用例只是程序化兜底
- **导航必须走真实 UI 路径**：不要用 URL 字符串替换（如 `.replace('/chat', '/build')`）等 hack 方式做页面导航。必须先阅读前端组件代码，了解实际的用户交互路径（如三点菜单 → 构建、侧栏 tab 切换等），然后用 `data-testid` 走正规 UI 操作
- **用 `test.step()` 结构化步骤**：禁止用注释标记步骤（如 `// Step 1:`），必须用 `test.step("描述", async () => { ... })`——既是文档又能在 Playwright HTML report 中结构化展示
- **`describe` / `step` 命名用中文**，与 Storybook name 保持一致，报告可读性优先
- **文件头 JSDoc 保留**：概述该 spec 覆盖的场景和预期结果，相当于行为规范的精简版
- **公共 helper 提取到 `web/e2e/helpers/`**：如登录、创建 Agent、配置模型等跨 spec 复用的操作，避免每个 spec 文件重复定义
- **不需要独立的 BDD 文档**：`test.describe` + `test.step` + 文件头 JSDoc 已覆盖行为描述，不维护额外的 `.feature` / BDD `.md` 文件
- **Monaco 编辑器不能用 `.fill()` / `.type()`**：Playwright 的标准输入方法对 Monaco 无效（Monaco 用自定义 input 机制，不响应标准 DOM 事件）。必须通过 `page.evaluate()` 调用 Monaco API：`monaco.editor.getModels()` 遍历找到目标 model，调用 `model.setValue(code)` 写入内容。识别目标 model 可通过内容判断（如空内容 `!model.getValue().trim()` 表示未填写的 handler）
- **Eval Run 结果验证不要依赖 `badge-passed` / `badge-failed`**：运行完成后展开的 detail 可能只有部分 ResultCard（auto-refresh 在 run 状态变为 completed 时停止，最后一次 fetch 可能拿到的是不完整的结果）。应直接验证 `run-pass-rate`（显示在 History 行标题上，run 完成后立即可见）
- **Eval E2E 中 `getByRole("button", { name })` 注意 sidebar case 名干扰**：sidebar 中 case 按钮的文本（如 "Import Test"）会匹配 `/Import/i`，导致 strict mode violation。需用 `{ name: "Import", exact: true }` 精确匹配

### Chat Persistence
- 分层持久化：session 创建 + 用户消息在 `streamText()` 前 `await` 保存（~10-50ms）；AI 响应消息保留在 `onFinish → after()` 中异步保存
- 正确：`Request → await createSession + saveUser → streamText → return → after() { saveAssistant }`
- 错误：`Request → streamText → return → after() { createSession + saveUser + saveAssistant }`（刷新丢消息 ❌）

### AI 模型调用（resolve-model）
- `models.json` 中的模型 ID 是 **Vercel AI Gateway** 格式（如 `deepseek/deepseek-v3.2`），通过网关调用时直接使用
- BYOK（用户自有 Key）模式下，模型名直接传给 Provider API——部分 Provider 的 Gateway 名与 API 名不同（如 DeepSeek 的 `deepseek-v3.2` 对应 API 的 `deepseek-chat`）
- **不要修改 `models.json` 来适配 Provider API**。正确做法是在 `resolve-model.ts` 的 `BYOK_MODEL_NAME_MAPPING` 中添加映射
- 新增 Provider 时检查其 API 模型名是否与 Gateway 名一致，不一致则补充映射

### Debug
- 服务端错误日志在 `.logs/dev.log`，排查 API 500 等服务端报错时优先查看此文件

### 收尾检查
- 代码修改完成后，必须依次执行 `make typecheck` 和 `make test`，确认类型无报错 + 测试通过后才算任务完成
- 新增或修改功能必须有对应的测试用例覆盖，不能只让现有测试通过就算完成
- 涉及用户交互流程的功能变更，运行 `make e2e` 确认端到端测试通过
- 同步 `web/guide/` 使用指南：根据本次改动内容，对 `web/guide/` 目录下的相关文档执行 CRUD——新增功能写新文档或新章节，修改功能更新对应段落，删除功能移除过时描述，确保文档与代码始终一致

### 测试账号

| 邮箱 | 密码 |
|------|------|
| yarnb@qq.com | archon123456Aa. |

