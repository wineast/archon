# Worktree Local

## 工作区
- 路径: `{{WORKTREE_PATH}}`
- **始终在此目录下工作，不要 cd 到其他位置**

## 端口

| 服务 | 端口 | 启动 |
|------|------|------|
| Dev Server | {{DEV_PORT}} | `make dev` |
| Storybook | {{STORYBOOK_PORT}} | `make storybook` |
| Drizzle Studio | {{STUDIO_PORT}} | `make db-studio` |
| Inngest Dev | {{INNGEST_PORT}} | `make inngest-dev` |
