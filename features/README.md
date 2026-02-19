# 功能树

按模块分类的功能索引。每个条目格式：

```
- [x] **功能名称** — 功能描述
  - 来源：为什么需要这个功能（可选，简单功能省略）
  - 使用说明：[doc.md](../guide/doc.md)（有对应文档时添加）
```

---

## 基础设施

- [ ] **本地 Docker 开发数据库** — 用 Docker PostgreSQL 替代 Neon 云数据库，省钱低延迟
  - 使用说明：[local-docker-db.md](../guide/local-docker-db.md)
- [ ] **Seed 系统模块化** — 将 seed.ts 单体函数拆分为 12 个独立 seeder 模块，统一连接管理，批量插入优化，结构化日志

## 数据模型

- [ ] **本体（Ontology）** — Agent 下的语义层，定义领域对象类型、关系、实例，将 Schema/Tool/Component/Wiki/Dataset 串成领域模型
  - 使用说明：[ontology.md](../guide/ontology.md)
- [ ] **统一 JSON 数据模型** — 将码表、对象、模板变量统一为分层 JSON：底层原子值无模板语法，上层可引用底层并使用模板
- [ ] **数据集自动依赖解析** — 去掉 layer 分层，扫描 Liquid 模板变量自动构建依赖图，Kahn 拓扑排序渲染，保存时检测循环
- [ ] **独立 Schema 资源管理** — 将 ToolParameter[] 抽象为独立 Schema 资源，tool output 和 component input 通过引用 schema key 保证数据结构一致
- [x] **Schema FK 关联迁移** — tools/components 的 schema 引用从字符串 key 改为 UUID 外键，删除 tools 内联 parameters 字段
- [ ] **修复 unique 约束范围** — modelConfigs、evalCases、evalJudgeConfigs 的 name 从全局唯一改为 (agentId, name) 联合唯一
- [ ] **Schema 组合与引用增强** — Schema includes 组合、json 字段级 schema 引用、enumRef 迁移为 UUID FK
- [x] **补全缺失索引与 FK** — chatSessions 加 agentId/userId 索引，agents 的 editingVersionId/publishedVersionId 加 FK 约束
- [x] **Functions 参数迁移到 Schema FK** — functions 表的 parameters/returnParameters 从内联 JSONB 改为引用 schemas 表的 FK，对齐 tools 的实现
- [x] **Tools 组件字段改为 FK** — tools 表去掉 component/componentSource 内联字段，改为 componentId FK 引用 components 表
- [x] **Wiki 主键迁移为 UUID** — wikiDocuments 的 PK 从 text 改为 uuid，统一全库主键类型

## Agent 配置

### 模型

- [ ] **全局模型注册表** — 新增 models 表存储可用模型列表，modelConfigs/evalJudgeConfigs 的模型选择从文本输入改为 Combobox 下拉

### 版本管理

- [x] **Agent 版本管理系统** — SemVer 版本号，发布时对所有关联配置做整体快照，支持查看历史版本和回滚

### 通用

- [x] **创建对话框 + Key 字段** — Model Config、Eval Case、Eval Judge Config 创建时弹出 Dialog 输入 Key+Name，Key 创建后只读

### Tools

- [ ] **前端工具执行** — 工具支持在浏览器端执行（client-side tool call），含 DB schema、API、前端 onToolCall、配置 UI
- [ ] **Tools Playground & Test Cases** — 为 Tools 添加 Playground 和 Test Cases 功能，参考 Functions 实现
- [ ] **Tools Key 字段与创建对话框** — tools 表添加 key 字段（agentId+key 联合唯一），去掉 name 全局唯一约束
- [ ] **简化工具 Handler 类型** — 移除本地 Key 注册表模式，只保留 URL、JS 代码、静态输出三种 handler 类型

### Components

- [x] **组件系统重构** — 组件对齐工具/函数体验，增加 Playground + Test Cases tab，Props 聚合为 tool 对象
  - 使用说明：[components.md](../guide/components.md)
- [x] **组件系统清理** — Schema Ref 拆为 input/output 两个字段，删除动态渲染器便捷变量，表单展示 generatedCss
- [ ] **组件闭包注入重构** — 组件依赖注入从 JSX 标签全局扫描改为闭包参数注入（对齐函数模式），去掉裸 JSX 片段支持，移除 inputSchemaId/outputSchemaId 字段

### Files

- [x] **静态资源上传（Vercel Blob）** — Agent Settings 新增 Files 标签页，集成 @vercel/blob 实现 PDF 上传、列表、删除

### Wiki

- [x] **Wiki include 仅按 key 查找** — `{% include %}` 标签从 title/id/key 三重匹配改为仅 key 查找，语义统一、不兜底
- [ ] **Wiki 移除独立 title** — 标题从 meta.title 获取，若无则 fallback 到内容开头
- [ ] **Wiki 表单化改造 + Key/Title 字段** — 文档页面统一为表单交互，数据库新增 title 和 key 字段，创建对话框输入 title+key

## 路由与导航

- [ ] **URL 路由重构（平级设计）** — 将 /[agentSlug] 拆分为 /chat 和 /build，使聊天和配置平级

## 评估系统

- [ ] **多轮评估** — 评估系统从单轮扩展为支持三种模式：单轮（single）、注入历史（injected）、逐轮对话（sequential），支持逐轮断言和 judge 评分

## 前端通用

- [ ] **编辑器组件整合** — 将所有编辑器（js/json/md/wiki）统一迁移到 `components/editors/`，co-locate Storybook 故事
- [ ] **表单重置按钮** — 为工具、函数、数据集表单添加"重置"按钮，dirty 时可用

## 前端渲染

- [ ] **动态组件系统** — UI 组件改为数据库驱动的动态渲染，不依赖本地静态代码
- [ ] **Parameters 组件抽离** — 从 tool-form/function-form 中抽离 ParameterList 为独立复用组件
- [ ] **Tools 设置页溢出修复** — 修复工具详情区域内容水平溢出，flex 布局链补充 min-w-0
- [ ] **JSX 编辑器 Storybook** — JsEditor、ComponentPreviewPanel 独立故事 + 组合 tab 切换预览

## 嵌入与分发

- [x] **嵌入式聊天 Widget SDK** — 通过 `<script>` 标签将 Agent 聊天嵌入第三方网站，气泡按钮 + iframe + embed token 匿名认证
  - 使用说明：[embed-widget.md](../guide/embed-widget.md)
- [ ] **嵌入式宿主通信** — Widget 与宿主页面双向 postMessage 通信：宿主上下文注入系统提示词、宿主工具执行、Widget JS API
  - 来源：嵌入场景下 AI 需要感知宿主页面状态并执行宿主侧操作
  - 使用说明：[embed-host-communication.md](../guide/embed-host-communication.md)

## 用户与权限

- [ ] **用户权限系统** — 平台角色 + Agent 四级角色 + 成员管理 + 公开私有模式 + 聊天记录可见性
  - 使用说明：[user-permissions.md](../guide/user-permissions.md)
- [ ] **Agent 设置页面重构** — 将 Agent 配置从聊天页面抽离到独立设置页 `/{slug}/settings`，聊天页瘦身
- [ ] **自定义认证 UI** — 去掉 Clerk 预构建 UI，用 shadcn 自建登录注册页，自定义用户菜单
