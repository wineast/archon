# 功能树

## 基础设施

- [ ] **本地 Docker 开发数据库** — 用 Docker PostgreSQL 替代 Neon 云数据库，省钱低延迟
  - 工作区: `local-docker-db` | 分支: `dev-local-docker-db-20260217`

## 数据模型

- [ ] **统一 JSON 数据模型** — 将码表、对象、模板变量统一为分层 JSON：底层原子值无模板语法，上层可引用底层并使用模板
  - 工作区: `simplify-json-model` | 分支: `dev-simplify-json-model-20260217`
- [ ] **数据集自动依赖解析** — 去掉 layer 分层，扫描 Liquid 模板变量自动构建依赖图，Kahn 拓扑排序渲染，保存时检测循环
  - 工作区: `dataset-auto-deps` | 分支: `dev-dataset-auto-deps-20260218`

## Agent 配置

### Tools

- [ ] **Tools Playground & Test Cases** — 为 Tools 添加 Playground 和 Test Cases 功能，参考 Functions 实现，含数据库表、API、UI
  - 工作区: `tools` | 分支: `dev-tools-20260219`

### Wiki

- [ ] **Wiki 移除独立 title** — 标题从 meta.title 获取，若无则 fallback 到内容开头
  - 工作区: `wiki-no-title` | 分支: `dev-wiki-no-title-20260217`

## 前端通用

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

## 用户与权限

- [ ] **用户权限系统** — 平台角色 + Agent 四级角色 + 成员管理 + 公开私有模式 + 聊天记录可见性
  - 工作区: `user-permissions` | 分支: `dev-user-permissions-20260217`
  - 详见 [guide/user-permissions.md](../guide/user-permissions.md)
- [ ] **Agent 设置页面重构** — 将 Agent 配置从聊天页面抽离到独立设置页 `/{slug}/settings`，聊天页瘦身，首页 AgentCard 增加设置入口
  - 工作区: `user-management` | 分支: `dev-user-management-20260218`
- [ ] **自定义认证 UI** — 去掉 Clerk 预构建 UI 组件，用 shadcn login-01/signup-01 自建登录注册页，自定义用户菜单替换 UserButton
  - 工作区: `custom-auth` | 分支: `dev-custom-auth-20260218`
