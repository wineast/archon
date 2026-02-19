# 删除静态定价组件和引擎代码

- **优先级**: medium
- **发现日期**: 2026-02-19

## 描述

Storybook 中存在定价组件（如 `PricingSopResultUI`），且 `web/src/lib/pricing/` 下有完整的定价引擎代码。Archon 是平台，这类业务组件应通过 Agent 的组件可视化系统动态创建并存储在数据库中（GMCC agent 的 seed 数据），而不是作为静态代码存在于仓库里。

## 分析

需要删除的文件/目录：

- `web/src/lib/pricing/` — 整个定价引擎目录（engine、rules、types 等）
- `web/src/components/__stories__/pricing-result.stories.tsx` — Storybook story
- `web/src/components/__stories__/pricing-mock-data.ts` — mock 数据

涉及 19 个文件，包括：
- 6 套定价规则（hermes-ca、hermes-non-ca、ocean、radiant-au、radiant-cra、radiant-portfolio、universe）
- 引擎核心（engine.ts、types.ts、schema-utils.ts、output-types.ts、index.ts）
- 测试（engine.test.ts）
- Storybook stories 和 mock 数据

## 修复方向

1. 删除 `web/src/lib/pricing/` 整个目录
2. 删除 `web/src/components/__stories__/pricing-result.stories.tsx` 和 `pricing-mock-data.ts`
3. 检查是否有其他文件引用了 pricing 模块，一并清理
4. 这些定价逻辑如果 GMCC agent 需要，应作为 seed 数据中的组件存在
