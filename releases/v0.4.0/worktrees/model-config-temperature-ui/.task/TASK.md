# 在 Model Config 编辑 UI 中放开温度（temperature）控制

DB schema 已有 `temperature` 字段（`modelConfigs` 和 `judgeConfigs`），但构建页的 Model Config 详情表单未暴露温度滑块/输入框，用户无法自行调整。

> Anchor: `web/src/db/schema.ts:564`（`modelConfigs.temperature`）、Model Config 详情表单组件
