# 功能树

按模块分类的功能索引。每个条目格式：

```
- [x] **功能名称** — 功能描述
  - 来源：为什么需要这个功能（可选，简单功能省略）
  - 使用说明：[doc.md](../guide/doc.md)（有对应文档时添加）
```

---

## 基础设施

- [x] **Agent 软删除** — agents 表增加 deletedAt 字段，删除改为标记而非物理删除，配套回收站 UI 支持恢复
  - 来源：生产环境误删 Agent 会级联清除全部关联数据且不可恢复
- [ ] **全资源软删除 + 统一回收站** — 所有 Agent 子资源（tools、functions、components、schemas、datasets、wiki、modelConfigs、evalCases、evalJudgeConfigs、objectTypes、objectRelations）加 deletedAt 字段，Agent 内统一回收站页面按资源类型分组，支持恢复和永久删除
- [ ] **配置变更审计日志** — 记录 Agent 配置资源的创建/更新/删除操作（谁+什么时间+哪个资源+什么操作），Agent Build 页面「操作记录」时间线 UI
- [ ] **函数/工具沙盒执行** — 用 isolated-vm（V8 Isolate）替代 `new Function()`，实现内存隔离、CPU 超时、零 API 访问的安全沙盒
  - 来源：FDA/母 Agent 生成的代码不可控，私有化部署需要安全合规
  - 使用说明：[tool-sandbox.md](../guide/tool-sandbox.md)
  - [ ] **P1：QuickJS 轻量沙盒** — 复用 Functions 的 quickjs-emscripten 沙盒，asyncify 构建支持 ToolContext 异步调用，覆盖所有 server 端 JS handler（聊天执行 + Playground + 测试用例），兼容 Edge Runtime
  - [ ] **P2：Vercel Sandbox 重型沙盒** — 通过 `@vercel/sandbox` 在 Firecracker 微虚拟机中执行，支持 npm 包和 HTTP 请求，工具表新增 `sandboxMode` 字段，UI 新增运行时切换
  - [ ] **P3：工具表单 UX 增强** — 执行环境为「服务端 + 代码」时展示运行时选择器（轻量/完整），Playground 显示沙盒类型标签和执行耗时对比
- [ ] **本地 Docker 开发数据库** — 用 Docker PostgreSQL 替代 Neon 云数据库，省钱低延迟
  - 使用说明：[local-docker-db.md](../guide/local-docker-db.md)
- [ ] **Seed 系统模块化** — 将 seed.ts 单体函数拆分为 12 个独立 seeder 模块，统一连接管理，批量插入优化，结构化日志

## 数据模型

- [ ] **本体（Ontology）** — Agent 下的语义层，定义领域对象类型、关系、实例，将 Schema/Tool/Component/Wiki/Dataset 串成领域模型
  - 使用说明：[ontology.md](../guide/ontology.md)
  - [ ] **P1：对象实例与 ToolContext CRUD** — object_instances/object_links 表 + ToolContext 内 `context.ontology.*` 读写 API
  - [ ] **P2：自动 CRUD 工具生成** — 定义 ObjectType 后一键生成 create/query/update/get 四个工具
  - [ ] **P2：外部数据源对接** — ObjectType 支持 external source，通过 API 调用企业系统获取数据
  - [ ] **P3：关系图谱可视化** — 交互式图谱展示对象类型之间的关系网络
  - [ ] **P4：对话式本体构建** — 母 Agent 引导 FDA 通过对话定义业务本体
- [ ] **统一 JSON 数据模型** — 将码表、对象、模板变量统一为分层 JSON：底层原子值无模板语法，上层可引用底层并使用模板
- [ ] **数据集自动依赖解析** — 去掉 layer 分层，扫描 Liquid 模板变量自动构建依赖图，Kahn 拓扑排序渲染，保存时检测循环
- [ ] **独立 Schema 资源管理** — 将 ToolParameter[] 抽象为独立 Schema 资源，tool output 和 component input 通过引用 schema key 保证数据结构一致
- [x] **Schema FK 关联迁移** — tools/components 的 schema 引用从字符串 key 改为 UUID 外键，删除 tools 内联 parameters 字段
- [ ] **修复 unique 约束范围** — modelConfigs、evalCases、evalJudgeConfigs 的 name 从全局唯一改为 (agentId, name) 联合唯一
- [ ] **Schema includes 改 junction table** — 将 schemas.includeSchemaIds UUID 数组改为独立关联表 schema_includes，利用 FK 约束保证引用完整性
  - 来源：Postgres 无法对数组元素做外键约束，删除被引用 Schema 会导致悬挂 UUID
- [ ] **Schema 组合与引用增强** — Schema includes 组合、json 字段级 schema 引用、enumRef 迁移为 UUID FK
- [x] **补全缺失索引与 FK** — chatSessions 加 agentId/userId 索引，agents 的 editingVersionId/publishedVersionId 加 FK 约束
- [x] **Functions 参数迁移到 Schema FK** — functions 表的 parameters/returnParameters 从内联 JSONB 改为引用 schemas 表的 FK，对齐 tools 的实现
- [x] **Tools 组件字段改为 FK** — tools 表去掉 component/componentSource 内联字段，改为 componentId FK 引用 components 表
- [x] **Wiki 主键迁移为 UUID** — wikiDocuments 的 PK 从 text 改为 uuid，统一全库主键类型
- [ ] **Wiki schema 清理** — 去掉 key/title 的 `.default("")` 历史遗留（对齐其他资源表），parentId 加 self-referencing FK 约束
- [ ] **去掉 agents.version 冗余字段** — 删除 agents 表的 version 字段，版本号统一从 publishedVersionId join agentVersions 获取

## Agent 配置

### Build Chat

- [ ] **Build Chat — 对话式配置助手** — Build 页面左侧聊天窗，通过对话操作所有资源（工具、Schema、Wiki、数据集等）
  - 使用说明：[build-chat.md](../guide/build-chat.md)

### 模型

- [ ] **全局模型注册表** — 新增 models 表存储可用模型列表，modelConfigs/evalJudgeConfigs 的模型选择从文本输入改为 Combobox 下拉

### 版本管理

- [x] **Agent 版本管理系统** — SemVer 版本号，发布时对所有关联配置做整体快照，支持查看历史版本和回滚

### 会话管理

- [ ] **会话查看器** — Build 页面新增 Sessions 标签页，管理员/编辑者可查看所有用户的聊天会话记录，左侧会话列表 + 右侧只读对话查看

### 通用

- [x] **创建对话框 + Key 字段** — Model Config、Eval Case、Eval Judge Config 创建时弹出 Dialog 输入 Key+Name，Key 创建后只读
- [ ] **配置变更审计日志** — 记录 Agent 资源的 CRUD 操作，Build 页面侧边栏查看操作时间线，支持按资源类型和成员筛选

### Tools

- [ ] **前端工具执行** — 工具支持在浏览器端执行（client-side tool call），含 DB schema、API、前端 onToolCall、配置 UI
- [ ] **Tools Playground & Test Cases** — 为 Tools 添加 Playground 和 Test Cases 功能，参考 Functions 实现
- [ ] **Tools Key 字段与创建对话框** — tools 表添加 key 字段（agentId+key 联合唯一），去掉 name 全局唯一约束
- [ ] **简化工具 Handler 类型** — 移除本地 Key 注册表模式，只保留 URL、JS 代码、静态输出三种 handler 类型

### Components

- [x] **组件系统重构** — 组件对齐工具/函数体验，增加 Playground + Test Cases tab，Props 聚合为 tool 对象
  - 使用说明：[components.md](../guide/components.md)
- [x] **组件系统清理** — Schema Ref 拆为 input/output 两个字段，删除动态渲染器便捷变量，表单展示 generatedCss
- [ ] **闭包依赖注入统一为对象解构** — 组件和函数的依赖注入从参数列表改为对象解构，去掉隐式全局注入，所有依赖显式出现在外层函数签名中
- [ ] **组件编辑器帮助文档** — JSX 编辑器旁增加帮助按钮，弹出 Markdown 渲染的编写规范（闭包结构、注入依赖、props 字段说明、示例）
- [ ] **组件 JSX 编辑器 AI 辅助** — 参考系统提示词的 AI 编辑功能，为 JSX 编辑器增加 AI 辅助编辑对话框

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

## 聊天与多模态

- [ ] **多模态聊天输入** — 聊天支持图片上传和语音输入，覆盖 chat 页面和 embed 页面
  - [ ] 图片/文件上传：附件按钮、拖拽粘贴、缩略图预览、发送给 LLM
  - [ ] 语音输入：Web Speech API 语音转文字，追加到输入框
  - [ ] 用户消息渲染文件附件

## 嵌入与分发

- [x] **嵌入式聊天 Widget SDK** — 通过 `<script>` 标签将 Agent 聊天嵌入第三方网站，气泡按钮 + iframe + embed token 匿名认证
  - 使用说明：[embed-widget.md](../guide/embed-widget.md)
- [ ] **嵌入式宿主通信** — Widget 与宿主页面双向 postMessage 通信：宿主上下文注入系统提示词、宿主工具执行、Widget JS API
  - 来源：嵌入场景下 AI 需要感知宿主页面状态并执行宿主侧操作
  - 使用说明：[embed-host-communication.md](../guide/embed-host-communication.md)

## 计费与用量

- [ ] **用量计费系统** — 统计每次 LLM 调用的 token 用量和费用，按 Agent/用户/模型维度聚合，含 Blob 存储统计，提供 Dashboard 可视化
  - 使用说明：[usage-metering.md](../guide/usage-metering.md)

## 监控

- [ ] **Agent 运行监控（P1：事件采集）** — 新增 runtimeEvents 表，在聊天执行流程中采集 LLM 调用延迟、工具执行结果、错误等运行时事件，非阻塞写入

## 组织与租户

- [ ] **组织/租户体系** — 新增 Organization 层，所有 Agent 必须归属组织，组织成员权限自动继承到 Agent，支持 org 级用量聚合
  - 来源：B2B 商业模式需要企业级数据隔离、统一计费、FDA 管理多客户
  - 使用说明：[org-tenant.md](../guide/org-tenant.md)

## 用户与权限

- [ ] **用户权限系统** — 平台角色 + Agent 四级角色 + 成员管理 + 公开私有模式 + 聊天记录可见性
  - 使用说明：[user-permissions.md](../guide/user-permissions.md)
- [ ] **Agent 设置页面重构** — 将 Agent 配置从聊天页面抽离到独立设置页 `/{slug}/settings`，聊天页瘦身
- [ ] **自定义认证 UI** — 去掉 Clerk 预构建 UI，用 shadcn 自建登录注册页，自定义用户菜单
