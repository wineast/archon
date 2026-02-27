# 合并/PR 摘要格式

PR 和工作区合并请求共用此格式。按需包含条件 section，无则不展示。

```markdown
## Summary
按 commit 类型分组（从 git log 的 conventional commit prefix 提取），每组用加粗标题，无则不展示该组：

**Features**
- <feat commit 对应的要点，说明 what + why>

**Fixes**
- <fix commit 对应的要点>

**Refactors**
- <refactor/chore commit 对应的要点>

## UX Changes
<仅当有用户可感知的变化时出现>
- 界面新增/修改了什么、用户操作路径变化、交互行为变化
- 写用户视角的描述，不写技术实现
- E2E 视频紧跟对应的 UX 变更项，格式：`[▶ spec 描述](/videos/<test-result-dir>/video.webm)`
- serve-report.mjs 自动将 .webm/.mp4 链接转为内联 video 播放器

## DX Changes
<仅当有开发者接口变化时出现>
- DB schema 变更、API 接口变化、配置项变化、导出格式变化
- 写开发者视角的描述，关注接口契约而非内部实现

## Database
<仅当 diff 包含 drizzle/ 迁移文件或 schema.ts 变更时出现>
- 新增/修改了哪些表或字段
- 是否为破坏性变更（如删列、改类型）
- Vercel 部署时会自动执行 db:migrate，提醒 reviewer 关注迁移安全性
- 工作区合并时提醒需要 make db-generate

## Breaking changes
<必写 section，无论是否存在不兼容变更>
- 有 breaking change 时：按以下三个维度逐一说明影响范围和迁移方式
  - **用户/FDE 层面**：Agent 对话行为变化、UI 交互变化、配置方式变化——任何用户可感知的"以前能用现在不一样了"
  - **技术/API 层面**：API 签名变更、postMessage 协议变更、环境变量变更——影响集成方和嵌入宿主系统
  - **数据层面**：DB schema 不兼容变更、已有数据需要迁移、配置格式变更——影响已部署实例
- 无 breaking change 时：写"无"并简要说明原因（如"纯 bug fix，行为收窄不扩展，无 API/数据变更"）

## Test plan
<已通过的检查项：typecheck、test、e2e 等，以及手动验证步骤>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 写作原则

- **Summary** 按 commit 类型分组（Features / Fixes / Refactors），先说 why 再说 what，避免只罗列文件名
- **条件 section** 无则不展示，不要留空标题（Breaking changes 除外——它是必写 section）
