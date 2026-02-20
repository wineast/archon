# 竞品与技术调研笔记

## Proma（2026-02-20 调研）

- 仓库：https://github.com/ErlichLiu/Proma
- 定位：Electron 桌面 AI 客户端，Claude Code 的图形化版本
- 技术栈：Electron + React 18 + Bun + Jotai + shadcn/ui + Tailwind 3
- AI 框架：Claude Agent SDK + 自研 Provider 适配器（多供应商）
- 数据存储：本地文件系统（JSON/JSONL，零数据库）
- 双模态：Chat 模式（多供应商 LLM）+ Agent 模式（Claude Agent SDK）
- 扩展机制：Skills（SKILL.md 文件）+ MCP（stdio/http/sse）
- 无企业级特性（无多租户、无权限、无计费、无版本管理）

### 值得借鉴
- **MCP 集成**：企业 API 对接的标准化路径，每个工作区独立配置
- **Skills 扩展模式**：轻量级 SKILL.md 定义技能，社区可贡献，可参考做 Agent 模板分发
- **三级权限模式**（auto/smart/supervised）：Agent 操作权限控制
- **提示词分层**（静态 system + 动态 per-message）：利于 prompt caching 降成本
- **全局 IPC 监听器提升**：页面切换不丢失流式输出

### Archon 已有优势
- 母 Agent 平台（造 Agent vs 用 Agent）
- Build Chat 对话式配置
- 企业基础设施（多租户、权限、版本、审计、计费）
- 三种交付形态（SaaS / 嵌入 / 私有化）
- 动态工具 + 组件（存 DB，热更新）
- 本体系统（领域建模）

---

## Claude Agent SDK vs Vercel AI SDK（2026-02-20）

### Claude Agent SDK（@anthropic-ai/claude-agent-sdk）
- 本质：Claude Code 的底层引擎以库形式暴露
- 核心：一个 `query()` 函数，返回异步消息流
- 内置 18+ 工具（Read/Write/Edit/Bash/Glob/Grep/WebSearch 等），SDK 自动执行
- 内置完整 agent loop（gather → act → verify）
- 原生支持子 Agent 编排（上下文隔离、并行执行）
- 原生支持 MCP、会话持久化（resume/fork）、沙箱
- **仅支持 Claude**，无 UI 层

### Vercel AI SDK（ai）
- 定位：Web AI 应用 UI 框架
- 模型无关（Claude/GPT/Gemini/Mistral/...）
- 深度集成 React（useChat、Streaming UI）
- 工具 schema 由开发者定义，执行逻辑自己写
- Token 级流式 + React Streaming
- 无内置 agent loop、子 Agent、MCP、会话持久化

### 结论：Archon 不需要 Agent SDK
1. **模型锁定**：只支持 Claude，我们需要多模型
2. **定位不匹配**：它适合"Agent 自己干活"（改代码、跑命令），我们需要"Agent 和用户对话 + 调用自定义工具"
3. **工具系统不够灵活**：我们的工具存 DB、支持 Server/Client/Host 三种执行目标、双层沙盒，比固定工具集更适合企业场景
4. **无 UI 层**：我们现有 Vercel AI SDK + React 前端仍然需要
5. Proma 用它是因为要做 Claude Code 图形化版本，复用引擎合理；我们做母 Agent 平台，Vercel AI SDK 更合适
