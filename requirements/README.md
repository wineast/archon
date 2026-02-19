# 功能树

## 基础设施

- [ ] **本地 Docker 开发数据库** — 用 Docker PostgreSQL 替代 Neon 云数据库，省钱低延迟
  - 工作区: `local-docker-db` | 分支: `dev-local-docker-db-20260217`

## 数据模型

- [ ] **统一 JSON 数据模型** — 将码表、对象、模板变量统一为分层 JSON：底层原子值无模板语法，上层可引用底层并使用模板
  - 工作区: `simplify-json-model` | 分支: `dev-simplify-json-model-20260217`
- [ ] **数据集自动依赖解析** — 去掉 layer 分层，扫描 Liquid 模板变量自动构建依赖图，Kahn 拓扑排序渲染，保存时检测循环
  - 工作区: `dataset-auto-deps` | 分支: `dev-dataset-auto-deps-20260218`
- [ ] **独立 Schema 资源管理** — 将 ToolParameter[] 抽象为独立 Schema 资源，tool output 和 component input 通过引用 schema key 保证数据结构一致
  - 工作区: `schema-resource` | 分支: `dev-schema-resource-20260219`
- [x] **Schema FK 关联迁移** — tools/components 的 schema 引用从字符串 key 改为 UUID 外键，删除 tools 内联 parameters 字段
  - 工作区: `schema-fk` | 分支: `dev-schema-fk-20260219`
- [ ] **修复 unique 约束范围** — modelConfigs、evalCases、evalJudgeConfigs 的 name 从全局唯一改为 (agentId, name) 联合唯一
  - 工作区: `fix-unique-constraints` | 分支: `dev-fix-unique-constraints-20260219`
- [ ] **Schema 组合与引用增强** — Schema includes 组合、json 字段级 schema 引用、enumRef 迁移为 UUID FK
  - 工作区: `schema-composition` | 分支: `dev-schema-composition-20260219`

## Agent 配置

### 模型

- [ ] **全局模型注册表** — 新增 models 表存储可用模型列表，modelConfigs/evalJudgeConfigs 的模型选择从文本输入改为 Combobox 下拉，种子数据包含 Vercel AI Gateway 所有主流 chat 模型
  - 工作区: `model-registry` | 分支: `dev-model-registry-20260219`

### 版本管理

- [x] **Agent 版本管理系统** — 为 Agent 添加 SemVer 版本号，发布时对所有关联配置做整体快照，支持查看历史版本和回滚
  - 工作区: `agent-versioning` | 分支: `dev-agent-versioning-20260219`

### 通用

- [x] **创建对话框 + Key 字段** — Model Config、Eval Case、Eval Judge Config 创建时弹出 Dialog 输入 Key+Name，参考 tool-create-dialog 模式，Key 创建后只读
  - 工作区: `create-dialog-key` | 分支: `dev-create-dialog-key-20260219`

### Tools

- [ ] **前端工具执行** — 工具支持在浏览器端执行（client-side tool call），类似 prompt-assist 的 onToolCall 机制，含 DB schema、API 改动、前端 onToolCall、工具配置 UI
  - 工作区: `client-tool-execution` | 分支: `dev-client-tool-execution-20260219`
- [ ] **Tools Playground & Test Cases** — 为 Tools 添加 Playground 和 Test Cases 功能，参考 Functions 实现，含数据库表、API、UI
  - 工作区: `tools` | 分支: `dev-tools-20260219`
- [ ] **Tools Key 字段与创建对话框** — tools 表添加 key 字段（agentId+key 联合唯一），去掉 name 全局唯一约束，参考 functions 实现创建对话框
  - 工作区: `tools-key-and-create-dialog` | 分支: `dev-tools-key-and-create-dialog-20260219`
- [ ] **简化工具 Handler 类型** — 移除本地 Key 注册表模式，只保留 URL、JS 代码、静态输出三种 handler 类型
  - 工作区: `tools-handler-simplify` | 分支: `dev-tools-handler-simplify-20260219`

### Components

- [x] **组件系统重构** — 组件对齐工具/函数体验，增加 Playground + Test Cases tab，Props 聚合为 tool 对象，增加 schemaRef，去掉 componentMockData
  - 工作区: `component-refactor` | 分支: `dev-component-refactor-20260219`
- [ ] **组件系统清理** — Schema Ref 拆为 input/output 两个字段，删除动态渲染器便捷变量，表单展示 generatedCss
  - 工作区: `component-cleanup` | 分支: `dev-component-cleanup-20260219`
- [ ] **组件组合复用** — 允许组件在 JSX 中引用其他组件，自动检测 PascalCase 名称映射到 kebab-case key，拓扑排序编译注入
  - 工作区: `component-composition` | 分支: `dev-component-composition-20260219`

### Files

- [ ] **静态资源上传（Vercel Blob）** — Agent Settings 新增 Files 标签页，集成 @vercel/blob 实现 PDF 上传、列表、删除，元数据存 DB
  - 工作区: `blob-upload` | 分支: `dev-blob-upload-20260219`

### Wiki

- [ ] **Wiki 移除独立 title** — 标题从 meta.title 获取，若无则 fallback 到内容开头
  - 工作区: `wiki-no-title` | 分支: `dev-wiki-no-title-20260217`
- [ ] **Wiki 表单化改造 + Key/Title 字段** — 文档页面统一为表单交互（编辑/预览/reset/dirty save），数据库新增 title 和 key 字段，创建对话框输入 title+key
  - 工作区: `wiki-form-and-key` | 分支: `dev-wiki-form-and-key-20260219`

## 路由与导航

- [ ] **URL 路由重构（方案A：平级设计）** — 将 /[agentSlug] 拆分为 /[agentSlug]/chat 和 /[agentSlug]/build，使聊天和配置平级，settings 重命名为 build
  - 工作区: `url-restructure` | 分支: `dev-url-restructure-20260219`

## 前端通用

- [ ] **编辑器组件整合** — 将所有编辑器（js/json/md/wiki）统一迁移到 `components/editors/`，co-locate Storybook 故事，更新全局 import
  - 工作区: `editors-consolidation` | 分支: `dev-editors-consolidation-20260219`
- [ ] **表单重置按钮** — 为工具、函数、数据集表单添加"重置"按钮，dirty 时可用，点击恢复初始值
  - 工作区: `fix/form-reset-buttons` | 分支: `dev-fix/form-reset-buttons-20260218`

## 前端渲染

- [ ] **动态组件系统** — 参考工具 handler 机制，UI 组件改为数据库驱动的动态渲染，不依赖本地静态代码
  - 工作区: `dynamic-components` | 分支: `dev-dynamic-components-20260217`
- [ ] **Parameters 组件抽离** — 从 tool-form/function-form 中抽离 ParameterList 为独立复用组件，创建 Storybook 故事
  - 工作区: `parameter-components` | 分支: `dev-parameter-components-20260218`
- [ ] **Tools 设置页溢出修复** — 修复工具详情区域内容水平溢出，flex 布局链补充 min-w-0 约束
  - 工作区: `fix-tools-overflow` | 分支: `dev-fix-tools-overflow-20260218`
- [ ] **JSX 编辑器 Storybook** — JsEditor、ComponentPreviewPanel 独立故事 + 组合 tab 切换预览组件故事
  - 工作区: `jsx-editor-stories` | 分支: `dev-jsx-editor-stories-20260218`

## 嵌入与分发

- [ ] **嵌入式聊天 Widget SDK** — 通过 `<script>` 标签将 Agent 聊天嵌入第三方网站，气泡按钮 + iframe 对话框，embed token 匿名认证
  - 工作区: `embed-widget` | 分支: `dev-embed-widget-20260219`

## 用户与权限

- [ ] **用户权限系统** — 平台角色 + Agent 四级角色 + 成员管理 + 公开私有模式 + 聊天记录可见性
  - 工作区: `user-permissions` | 分支: `dev-user-permissions-20260217`
  - 详见 [guide/user-permissions.md](../guide/user-permissions.md)
- [ ] **Agent 设置页面重构** — 将 Agent 配置从聊天页面抽离到独立设置页 `/{slug}/settings`，聊天页瘦身，首页 AgentCard 增加设置入口
  - 工作区: `user-management` | 分支: `dev-user-management-20260218`
- [ ] **自定义认证 UI** — 去掉 Clerk 预构建 UI 组件，用 shadcn login-01/signup-01 自建登录注册页，自定义用户菜单替换 UserButton
  - 工作区: `custom-auth` | 分支: `dev-custom-auth-20260218`
