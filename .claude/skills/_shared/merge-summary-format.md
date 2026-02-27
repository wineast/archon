# 合并/PR 摘要格式

PR 和工作区合并请求共用此格式。按需包含条件 section，无则不展示。

```markdown
## Summary
<1-5 个要点，每个要点说明 what + why>

## Database
<仅当 diff 包含 drizzle/ 迁移文件或 schema.ts 变更时出现>
- 新增/修改了哪些表或字段
- 是否为破坏性变更（如删列、改类型）
- Vercel 部署时会自动执行 db:migrate，提醒 reviewer 关注迁移安全性
- 工作区合并时提醒需要 make db-generate

## Breaking changes
<仅当存在不兼容变更时出现，覆盖三个维度>
- **用户/FDE 层面**：Agent 对话行为变化、UI 交互变化、配置方式变化——任何用户可感知的"以前能用现在不一样了"
- **技术/API 层面**：API 签名变更、postMessage 协议变更、环境变量变更——影响集成方和嵌入宿主系统
- **数据层面**：DB schema 不兼容变更、已有数据需要迁移、配置格式变更——影响已部署实例
每个维度列出影响范围和迁移方式。

## Screenshots
<仅当有 UI 变更时出现>

## Test plan
<已通过的检查项：typecheck、test、e2e 等，以及手动验证步骤>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 写作原则

- **Summary** 先说 why 再说 what，避免只罗列文件名
- **条件 section** 无则不展示，不要留空标题
