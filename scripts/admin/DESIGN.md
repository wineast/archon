# Admin 管理面板 — 设计方案

## 核心概念

### 文档任务（Atomic Task）

`todo/` 和 `issues/` 两个目录作为**文件数据库**，每个 `.md` 文件就是一个**原子任务文档**。

- **Todo** — 需求类任务（新功能、优化）
- **Issue** — 缺陷类任务（Bug、安全漏洞）

每个任务文档的 frontmatter 记录元数据：

```yaml
---
title: Wiki 查询缺少 agentId 过滤
priority: P0
status: running
worktree: cross-agent-wiki-data-leak-no-agentid-filter
---
```

### 任务状态机

```
pending → backlog → ready → merged → /archive → releases/vN/
                          → cancelled/wontfix
```

| 状态 | 含义 |
|------|------|
| `pending` | 新建，未评审 |
| `backlog` | 已评审，暂不处理 |
| `ready` | 已评审，可以派发 |
| `merged` | 工作区已合并到上游分支 |
| `cancelled` / `wontfix` | 终态，不再处理 |

**归档**：`merged` 任务通过 `/archive` 技能移入 `releases/vN/` 目录（物理隔离），不再使用 `done`/`closed` 状态。

### 工作区（Worktree）

当任务进入 `ready` 状态后，**派发**操作会：

1. 创建一个 Git Worktree（`.worktrees/<task-id>/`）
2. 将任务状态改为 `running`
3. 在工作区中关联任务文档

**一个工作区对应一个任务文档**，工作区的唯一目标就是解决这个任务。

### 工作区阶段（Phase）

工作区内的任务处理分为三个阶段：

```
chain（技能链路）→ review（评审）→ merge（合并）
```

| 阶段 | 含义 |
|------|------|
| `chain` | 技能链路正在执行，Claude Code 在工作区内工作 |
| `review` | 链路完成，人工评审报告和代码变更 |
| `merge` | 评审通过，准备合并到上游分支 |

阶段信息持久化在 `.worktree/task.json` 中：

```json
{
  "type": "issue",
  "id": "cross-agent-wiki-data-leak-no-agentid-filter",
  "path": "issues/open/cross-agent-wiki-data-leak-no-agentid-filter.md",
  "phase": "chain"
}
```

## 技能链路（Skill Chain）

工作区通过**技能链路**来解决任务。技能链路是一组按顺序执行的 Claude Code 技能，在工作区内操作，产出一系列报告。

### 需求链路（req-chain）— 用于 Todo

```
需求报告(REQ.md) → 实现报告(IMPL_REPORT.md) → 验收报告(ACCEPT_REPORT.md)
                                                → [可选] 守护规约 + 守护报告
```

### 缺陷链路（defect-chain）— 用于 Issue

```
缺陷报告(DEFECT.md) → 修复报告(FIX_REPORT.md) → 验证报告(VERIFY_REPORT.md)
                                                  → [可选] 守护规约 + 守护报告
```

报告文件存放在 `.worktree/` 目录下，Admin 面板可以直接读取并展示。

## 终端管理

终端是一个**操作系统资源**，Claude Code 运行在其中，修改工作区文件。

Admin 面板不内嵌终端，而是通过 AppleScript 管理 macOS Terminal.app 窗口：

- **打开终端** — 创建新的 Terminal.app 窗口，`cd` 到工作区，启动技能链路
- **激活终端** — 如果窗口已存在，将其激活到前台
- **内存追踪** — 后端 Map 记录 `taskId → 窗口标题`，仅运行时有效

```
Admin 面板                          macOS
┌──────────────┐                  ┌──────────────┐
│ "打开终端"    │  → AppleScript → │ Terminal.app  │
│  按钮        │                  │ claude /chain │
│              │                  │ (修改工作区)   │
│ 展示报告     │  ← 文件系统 ←    │ 产出报告文件   │
│ 展示变更     │                  │              │
└──────────────┘                  └──────────────┘
```

## Admin 面板展示

### 任务列表

表格列：类型 | 优先级 | 标题 | 状态 | 工作区 | 阶段

支持按类型（Todo/Issue）、优先级（P0-P3）、状态筛选。

### 任务展开区域

点击任务行展开，显示：

1. **Timeline** — 5 步流程进度条，带操作按钮
   - 就绪 → 派发 → 链路 → 合并 → 完成
2. **Git 状态** — 当前分支 + ahead/behind
   - 暂存区文件列表
   - 工作区文件列表
   - 未跟踪文件
   - 已提交变更（vs base branch，三点 diff，只显示工作区自己的修改）
3. **报告查看器** — 标签页切换查看各阶段报告（Markdown 渲染）
4. **SSE 终端** — 用于 sync/merge 等一次性操作的流式输出

### 无工作区的任务

展开后显示任务文档的 Markdown 内容（去掉 frontmatter）。

## 技术架构

```
scripts/admin/
├── main.mjs                  # HTTP Server 入口
├── routes/
│   ├── tasks.mjs             # 任务 CRUD + 派发 + 终端
│   ├── reports.mjs           # 报告读取 + sync/merge
│   └── worktrees.mjs         # 工作区管理
├── services/
│   ├── task-scanner.mjs      # 扫描 todo/ issues/ 文件
│   ├── worktree-scanner.mjs  # 扫描 .worktrees/ 目录
│   ├── git-ops.mjs           # Git 命令封装
│   ├── command-runner.mjs    # SSE 流式命令执行
│   └── terminal-manager.mjs  # AppleScript 终端窗口管理
├── ui/                       # React 前端（Vite 构建）
│   └── src/
│       ├── panels/TasksPanel.tsx
│       ├── components/
│       │   ├── TaskRow.tsx
│       │   ├── TaskExpanded.tsx
│       │   ├── Timeline.tsx
│       │   ├── ReportViewer.tsx
│       │   ├── Terminal.tsx    # SSE 只读终端
│       │   ├── Badge.tsx
│       │   └── Spinner.tsx
│       ├── hooks/use-terminal.ts
│       ├── api/client.ts
│       └── types.ts
└── dist/                     # 构建产物
```

### 依赖

- **后端**：零外部依赖，纯 Node.js 原生 HTTP + child_process
- **前端**：React 19 + Vite 6 + marked（Markdown 渲染）
- **构建**：`make admin-build`（Vite 构建到 dist/）
- **运行**：`make admin`（生产）/ `make admin-dev`（开发 HMR）

## 数据流

```
todo/*.md  ──┐
              ├─→ task-scanner ─→ tasks[] ──┐
issues/*.md ─┘                               │
                                              ├─→ /api/tasks/data → 前端表格
.worktrees/*/.worktree/ ─→ worktree-scanner ─┘
  ├── task.json          (任务关联 + 阶段)
  ├── meta.json          (base branch 等)
  ├── REQ.md / DEFECT.md (报告文件)
  ├── IMPL_REPORT.md / FIX_REPORT.md
  └── ...
```

文件系统变更通过 `fs.watch` 监听，自动推送 SSE 事件通知前端刷新。
