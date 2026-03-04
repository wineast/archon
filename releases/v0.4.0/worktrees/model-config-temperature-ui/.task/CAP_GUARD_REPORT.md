# 需求守护报告：Model Config 温度 Slider + 输入框双控

> 执行时间：2026-03-04 14:58
> 关联规约：[CAP_GUARD.md](CAP_GUARD.md)
> 分支：`dev-model-config-temperature-ui-20260304`

## 1. 规约概要

### Capability
Model Config 详情表单中的温度控件为 Slider + 数字输入框组合，双向联动，范围 0-2，步长 0.1，默认值 0.7。

### 覆盖统计
| 元素 | 规约数 | 测试数 | 通过 | 失败 |
|------|--------|--------|------|------|
| Criteria Matrix | 8 | 8 | 8 | 0 |
| Journey Test | 1 | 1 | 1 | 0 |
| Constraint Guard | 2 | 2 | 2 | 0 |
| Degradation Fence | 0 | 0 | — | — |

## 2. 测试结果

### 静态检查
- `make typecheck`：通过
- `make test`：model-config-detail.test.tsx 13/13 通过（全局 1 个预存失败 session-history，与本次无关）

### 单元测试
| 文件 | 用例数 | 通过 | 失败 | 覆盖规约 |
|------|--------|------|------|----------|
| `src/components/model-config/__tests__/model-config-detail.test.tsx` | 13 | 13 | 0 | AC-1~8, Journey-1, CG-1~2 |

## 3. Coverage Matrix（覆盖矩阵）

| 来源 | 测试用例 | 文件 | 层级 | 结果 |
|------|----------|------|------|------|
| AC-1 | renders slider and number input with default value | model-config-detail.test.tsx | Unit | ✅ |
| AC-2 | renders slider and number input with default value | model-config-detail.test.tsx | Unit | ✅（Slider 渲染即验证 props） |
| AC-3 | changing temperature input enables Save button | model-config-detail.test.tsx | Unit | ✅ |
| AC-4 | clamps value exceeding max to 2 | model-config-detail.test.tsx | Unit | ✅ |
| AC-4b | clamps negative value to 0 | model-config-detail.test.tsx | Unit | ✅ |
| AC-5 | changing temperature input enables Save button | model-config-detail.test.tsx | Unit | ✅（同 AC-3） |
| AC-6 | save passes temperature to onSave | model-config-detail.test.tsx | Unit | ✅ |
| AC-7 | renders hint text | model-config-detail.test.tsx | Unit | ✅ |
| AC-8 | reset restores original temperature | model-config-detail.test.tsx | Unit | ✅ |
| Journey-1 | full temperature adjustment journey | model-config-detail.test.tsx | Unit | ✅ |
| CG-1 | renders slider and number input with default value | model-config-detail.test.tsx | Unit | ✅（初始值 0.7） |
| CG-2 | clamps value exceeding max to 2 + clamps negative value to 0 | model-config-detail.test.tsx | Unit | ✅ |

## 4. Verdict（裁定）

### 判决
✅ 守护就绪

### 证据摘要
- **Criteria Matrix**：8/8 条覆盖，全部通过
- **Journey Test**：1 个旅程通过
- **Constraint Guard**：2/2 条覆盖，全部通过
- **Degradation Fence**：无缺口，无需守护

### 未覆盖项
无

### 新增测试文件
| 文件 | 类型 | 用例数 |
|------|------|--------|
| `src/components/model-config/__tests__/model-config-detail.test.tsx` | Unit | 新增 8 个（从 5 增至 13） |

## 过程备注

[重试] 负数 clamp 测试初次用 `userEvent.type` 输入 "-1" 失败——jsdom 中 number input 对负号处理不符合预期。改用 `fireEvent.change` 直接触发 onChange 事件解决。
