---
name: req-chain
description: 需求链路编排。自动执行完整需求链路：需求→实现→验收→守护。当调度器自动派发 todo 任务或用户说"跑链路"、"req-chain"时调用。
allowed-tools: Read, Glob, Skill
---

自动编排需求链路四步骤，从断点处继续执行直到完成。

## 链路步骤

| 步骤 | 技能 | 产出文件 |
|------|------|----------|
| 1. 需求 | `/requirement` | `.task/REQ.md` |
| 2. 实现 | `/implement` | `.task/IMPL_REPORT.md` |
| 3. 验收 | `/accept` | `.task/ACCEPT_REPORT.md` |
| 4. 守护 | `/cap-guard` | `.task/CAP_GUARD.md` + `CAP_GUARD_REPORT.md` |

## 执行流程

### 1. 读取任务信息

读取 `.task/TASK.md` 获取任务描述。如果文件不存在，停止并告知用户缺少任务描述。

### 2. 检查链路进度

按文件存在性判断已完成的步骤：
- `.task/REQ.md` 存在 → 步骤 1 已完成
- `.task/IMPL_REPORT.md` 存在 → 步骤 2 已完成
- `.task/ACCEPT_REPORT.md` 存在 → 步骤 3 已完成
- `.task/CAP_GUARD.md` 且 `.task/CAP_GUARD_REPORT.md` 都存在 → 步骤 4 已完成

输出当前进度摘要（哪些步骤已完成，从哪一步开始）。

### 3. 注入上下文并依次执行

如果步骤 1 尚未完成，先输出 TASK.md 内容作为上下文，然后调用 `/requirement`。

对每个未完成的步骤依次调用对应技能（使用 Skill 工具）：
1. 调用技能
2. 确认产出文件已生成
3. 如果产出文件缺失，停止链路并报告失败
4. 继续下一步

### 4. 完成总结

所有步骤完成后，输出链路完成总结，列出每个步骤的状态。

## 关键约束

- **幂等**：已完成的步骤直接跳过
- **失败即停**：任何步骤的产出文件缺失则中断链路
- **入口文件**：`.task/TASK.md` 是唯一的任务输入
