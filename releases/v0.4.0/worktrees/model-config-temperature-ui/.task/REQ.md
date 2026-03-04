# 需求报告：Model Config 温度控制改为 Slider + 输入框组合

> 创建时间：2026-03-04 14:00
> 分支：`dev-model-config-temperature-ui-20260304`

## 1. Who（主体 + 场景）

### 使用者
FDE 或 Agent 构建者，在构建页配置 Model Config 时调整模型温度。

### 使用场景
日常配置场景。当前 temperature 控件是纯数字输入框，用户只能手动输入数值，缺少直观的范围感知和快速拖拽调节能力。

## 2. Why（动机）

### 痛点
纯数字输入框交互体验差：用户看不到 0-2 范围内当前值的相对位置，也无法通过拖拽快速调节。

### 做了的价值
Slider + 数字输入框的组合形式让用户既能拖拽快速定位，又能精确输入数值，交互体验显著提升。

### 不做的代价
功能可用但体验粗糙，与其他平台（如 OpenAI Playground）的温度控制交互存在差距。

## 3. What（能力声明）

### 核心能力
- 将 Model Config 详情表单中的 temperature 控件从纯数字输入框改为 **Slider + 数字输入框** 的组合形式
- Slider 和输入框双向联动：拖 Slider 更新输入框，编辑输入框更新 Slider
- 范围 0-2，步长 0.1，保持现有默认值 0.7 和验证逻辑不变

### 不做（Out of Scope）
- 不改变 DB schema、API 接口、运行时传参等后端逻辑
- 不为 Judge Config 添加温度控制
- 不改变温度的取值范围或默认值

## 4. Acceptance（验收标准）

- [ ] Model Config 详情表单的 temperature 区域显示 Slider + 数字输入框组合
- [ ] Slider 范围 0-2，步长 0.1
- [ ] 拖动 Slider 时，数字输入框实时同步更新
- [ ] 在数字输入框输入合法值时，Slider 实时同步更新
- [ ] 输入框输入超出 0-2 范围的值时，自动 clamp 到边界
- [ ] 修改温度后 dirty 检测正常，Save/Reset 按钮可用
- [ ] 保存后温度值正确持久化
- [ ] 提示文字 "0 = more precise, 2 = more creative" 保留

## 5. Constraint（约束）

### 业务约束
- 温度范围保持 0-2，默认值保持 0.7

### 技术约束
- 复用项目已有的 `@/components/ui/slider`（Radix Slider）
- 遵循项目 UI 约束：label 样式 `text-xs font-medium text-muted-foreground`，label 与控件间距 `mt-1`
- 当前组件使用 useState 管理表单状态（非 react-hook-form），保持一致

### 不可打破的现有行为
- temperature 的保存/重置/脏值检测逻辑保持不变
- API 接口不变

## 参考
- Slider 组件：`web/src/components/ui/slider.tsx`
- Slider 使用示例：`web/src/components/memory/memory-detail.tsx:147-157`（Importance 滑块 + Controller 模式）
- 当前表单：`web/src/components/model-config/model-config-detail.tsx:270-290`

## 过程备注

[惊讶] 任务描述称"表单未暴露温度控制"，但代码调研发现 temperature 输入框已完整实现。实际需求是改进 UI 交互形式（纯输入框 → Slider + 输入框组合）。
