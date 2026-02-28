---
priority: P1
---
# 新用户引导流程（降低 FDE 上手门槛）

新用户首次登录无任何引导，直接面对空白页面。需要：
1. 欢迎引导：展示 FDE 工作流程的交互式介绍
2. Agent 创建向导：选模板 → 配置 → 测试 → 部署的分步引导
3. 上下文提示：首次使用 Build Chat、Eval、Embed 时显示功能引导
4. 示例 Agent：预置展示最佳实践的 Demo Agent
5. 上手清单：完成 5 步部署首个 Agent，带进度追踪

> Anchor: `web/src/app/[locale]/page.tsx`（Agent 列表页）, `web/src/components/ui/guide-dialog.tsx`
