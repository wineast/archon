# Archon 技术架构概览

## 一、产品定位

Archon 是一个**母 Agent 平台**——通过对话式交互创建、配置、部署子 Agent，让不写代码的人也能快速落地 AI 应用。

核心交付形态覆盖三种场景：
- **线上 SaaS**：URL 直接访问
- **嵌入宿主系统**：Embed Widget，通过 postMessage 与企业前端双向通信
- **私有化部署**

---

## 二、技术栈总览

| 层次 | 选型 | 说明 |
|------|------|------|
| **前后端框架** | Next.js 16 (App Router) + TypeScript | 前后端一体化，API Routes 作为后端 |
| **前端 UI** | React 19 + Tailwind CSS 4 + shadcn/ui | 组件库基于 Radix UI，图标用 Lucide |
| **数据库** | PostgreSQL (Neon Serverless) + pgvector | 支持向量检索，ORM 用 Drizzle |
| **AI 能力** | Vercel AI SDK | 统一对接 13+ 家 LLM 供应商 |
| **认证** | Clerk | 开箱即用的用户/组织管理 |
| **模板引擎** | LiquidJS | 系统提示词、Wiki、工具输出均支持模板变量 |
| **JS 沙箱** | quickjs-emscripten | 安全执行用户编写的工具代码 |
| **代码编辑器** | Monaco Editor | 浏览器内代码编辑体验 |
| **文件存储** | Vercel Blob | Agent 附件文件托管 |
| **测试** | Vitest + Playwright | 单元测试 + E2E |
| **部署** | Vercel | 生产环境托管 |

### 已对接的 AI 供应商

Anthropic、OpenAI、Google、xAI、DeepSeek、Mistral、Cohere、Perplexity、阿里通义、月之暗面、智谱、MiniMax、字节豆包——共 13 家，通过 BYOK（Bring Your Own Key）模式接入，用户自带 API Key。

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────┐
│                     用户接入层                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ SaaS 页面 │  │ Embed Widget │  │ 分享链接页面   │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  │
└───────┼───────────────┼──────────────────┼──────────┘
        │               │                  │
┌───────▼───────────────▼──────────────────▼──────────┐
│                  Next.js App Router                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │              API Routes（后端）                   │ │
│  │  • 对话流（Streaming）  • Agent CRUD             │ │
│  │  • 资源池管理           • 用量计量               │ │
│  │  • AI 辅助编辑          • 版本管理               │ │
│  └───────────┬─────────────────┬───────────────────┘ │
└──────────────┼─────────────────┼────────────────────┘
               │                 │
    ┌──────────▼──────┐  ┌──────▼──────────┐
    │  Neon Postgres   │  │   LLM 供应商    │
    │  + pgvector      │  │  (13+ 家)       │
    └─────────────────┘  └─────────────────┘
```

---

## 四、核心业务模块

### 1. 共享资源池

平台资源统一管理，支持 **7 种资源类型**：

| 资源类型 | 说明 |
|----------|------|
| Tool（工具） | AI 可调用的函数，支持服务端/客户端/宿主三种执行目标 |
| Component（组件） | 自定义 UI 组件，工具调用后可渲染可视化结果 |
| Function（函数） | 服务端可复用逻辑，在工具/组件间共享 |
| Dataset（数据集） | 结构化数据，注入模板变量 |
| Wiki（文档） | 知识库文档，支持树形结构和模板语法 |
| Schema（Schema） | JSON Schema，用于数据校验和本体定义 |
| MCP Server | Model Context Protocol 服务接入 |

资源来源分三类：**系统内置**（builtin）、**用户创建**（user）、**市场下载**（marketplace，预留）。Agent 通过引用机制选择性使用池中资源。

### 2. Agent 版本系统

每个 Agent 维护**草稿版本**和**已发布版本**两个指针：
- 所有编辑操作作用于草稿版本
- 发布时对草稿打快照，切换发布指针
- 支持版本回滚

### 3. 工具沙箱

工具执行分三种模式，适配不同场景：
- **Server**：在服务端安全沙箱中执行（quickjs 隔离）
- **Client**：在浏览器端执行，可渲染自定义 UI 组件
- **Host**：通过 postMessage 转发到宿主页面执行（企业嵌入场景，与内部系统打通）

### 4. Slot 系统（母 Agent 架构）

平台内置 4 个功能 Slot，每个 Slot 背后是一个 Agent 实例，可热插拔：

| Slot | 用途 |
|------|------|
| Builder | 配置 AI 助手——辅助用户搭建 Agent |
| Assist | 业务辅助——为终端用户提供问答服务 |
| Evaluator | 评测裁判——对 Agent 输出做多维度打分 |
| Support | 客服泡——平台内嵌支持 |

### 5. 其他能力模块

- **记忆系统**：基于 pgvector 向量存储，支持长期记忆注入和自动衰减
- **RAG**：文档分块 + 向量检索，增强 Agent 知识
- **本体系统**：定义业务对象类型和关系，结构化 Agent 的认知
- **评测系统**：单轮/多轮对话测试用例，自动化回归评测
- **用量计量**：按 Token 用量记录，支持积分余额体系

---

## 五、多租户与权限

- **组织（Org）** 为顶层租户，用户可属于多个组织
- **角色体系**：组织级（Owner/Admin/Member）+ Agent 级（Owner/Admin/Editor/Viewer）
- **数据隔离**：每条 API 请求经过 Clerk 鉴权 + 组织/Agent 权限校验
- **BYOK**：各组织自带 API Key，密钥加密存储

---

## 六、部署架构

```
生产环境:
  ┌────────────┐     ┌──────────────────┐
  │   Vercel    │────▶│  Neon Serverless  │
  │  (Next.js)  │     │   PostgreSQL      │
  └──────┬─────┘     └──────────────────┘
         │
         ├──▶ Vercel Blob（文件存储）
         ├──▶ Clerk（认证服务）
         └──▶ 13+ 家 LLM API（BYOK）

本地开发:
  Docker Compose 启动 PostgreSQL (pgvector)
  支持 Worktree 并行开发（多分支各自独立端口）
```

- **数据库迁移**：开发用 `db-push` 快速迭代，生产只走迁移文件
- **质量保障**：TypeScript 类型检查 + Vitest 单元测试 + Playwright E2E
- **CI/CD**：Vercel 自动部署

---

## 七、关键技术决策

| 决策 | 理由 |
|------|------|
| 前后端一体化（Next.js） | 减少维护成本，API Routes 足够覆盖当前规模 |
| Neon Serverless Postgres | 按用量计费、自动扩缩容，适合 SaaS 场景 |
| pgvector 向量扩展 | 记忆和 RAG 不需要单独部署向量数据库 |
| quickjs 沙箱 | 轻量安全，用户工具代码在隔离环境执行 |
| BYOK 模式 | 降低平台 Token 成本，用户自带 Key |
| LiquidJS 模板 | 让非技术人员也能配置动态提示词 |
| Clerk 认证 | 开箱即用的多租户、SSO、Webhook 支持 |
