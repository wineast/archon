# 需求守护规约：Model Config 温度 Slider + 输入框双控

> 生成时间：2026-03-04 14:55
> 关联需求：[REQ.md](REQ.md)
> 关联实现：[IMPL_REPORT.md](IMPL_REPORT.md)
> 关联验收：[ACCEPT_REPORT.md](ACCEPT_REPORT.md)
> 分支：`dev-model-config-temperature-ui-20260304`

## 1. Capability（能力宣言）

Model Config 详情表单中的温度控件为 Slider + 数字输入框组合，双向联动，范围 0-2，步长 0.1，默认值 0.7。用户可通过拖拽 Slider 或精确输入数值调整温度，修改后支持脏值检测、保存持久化和重置。

## 2. Criteria Matrix（标准矩阵）

| # | 验收标准 | Given | When | Then | Level | Boundaries |
|---|----------|-------|------|------|-------|------------|
| AC-1 | 显示 Slider + 数字输入框组合 | 渲染 ModelConfigDetail | 查看 Temperature 区域 | Slider 和 spinbutton 同时存在 | Unit | — |
| AC-2 | Slider 范围 0-2，步长 0.1 | 渲染 ModelConfigDetail | 检查 Slider props | min=0, max=2, step=0.1 | Unit | — |
| AC-3 | 输入框修改时 Slider 同步 | 温度为 0.7 | 在输入框输入 1.5 | Slider 值变为 1.5，dirty=true | Unit | — |
| AC-4 | 超范围值 clamp | 温度为 0.7 | 在输入框输入 5 | 温度 clamp 到 2 | Unit | 输入负数→clamp 到 0；输入空→归 0 |
| AC-5 | dirty 检测 + Save/Reset | 温度为 0.7 | 修改温度为 1.2 | Save/Reset 按钮启用 | Unit | — |
| AC-6 | save 传递 temperature | 修改温度为 1.5 | 点击 Save | onSave 收到 temperature: 1.5 | Unit | — |
| AC-7 | 提示文字保留 | 渲染 ModelConfigDetail | 查看 Temperature 区域 | "0 = more precise, 2 = more creative" 可见 | Unit | — |
| AC-8 | Reset 恢复原值 | 温度改为 1.5 | 点击 Reset | 温度回到 0.7 | Unit | — |

## 3. Journey Test（旅程测试）

### Journey 1: 温度调节完整旅程
- **Who**: FDE 配置 Agent 模型温度
- **Level**: Unit（组件级旅程，模拟完整操作序列）
- **Flow**:
  1. 渲染组件，确认初始温度 0.7
  2. 修改输入框为 1.5
  3. 确认 Save 按钮启用
  4. 点 Save，验证 onSave 传参
  5. Reset 不可用（保存后 dirty=false）
- **关键断言**: 整个操作序列无阻断，状态流转正确

## 4. Constraint Guard（约束守卫）

| # | 约束 | Given | When | Then | Level |
|---|------|-------|------|------|-------|
| CG-1 | 默认值 0.7 | 新建 Config（temperature=0.7） | 渲染组件 | spinbutton 初始值为 0.7 | Unit |
| CG-2 | 范围不超 0-2 | 温度为 0.7 | 输入 -1 和 5 | 分别 clamp 到 0 和 2 | Unit |

## 5. Degradation Fence（退化围栏）

无（实现报告声明 Known Gaps 为无，验收报告确认无缺口）

## 6. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 层级 | 状态 |
|------|----------|------|------|
| AC-1 | renders slider and number input with default value | Unit | ✅ 已有 |
| AC-2 | slider has correct min/max/step props | Unit | ⏳ 待补 |
| AC-3 | changing temperature input enables Save button | Unit | ✅ 已有 |
| AC-4 | clamps value exceeding range | Unit | ⏳ 待补 |
| AC-5 | changing temperature input enables Save button | Unit | ✅ 已有（同 AC-3） |
| AC-6 | save passes temperature to onSave | Unit | ✅ 已有 |
| AC-7 | renders hint text | Unit | ✅ 已有 |
| AC-8 | reset restores original temperature | Unit | ⏳ 待补 |
| Journey-1 | full temperature adjustment journey | Unit | ⏳ 待补 |
| CG-1 | default value is 0.7 | Unit | ✅ 已有（AC-1 覆盖） |
| CG-2 | clamps out-of-range values | Unit | ⏳ 待补（同 AC-4） |
