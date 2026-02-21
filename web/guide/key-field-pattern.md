# KeyField 组件规范

## 用途

资源详情页中展示只读的 `key` 标识符，支持一键复制。

## 设计原则

- **只读**：key 在创建后不可修改，仅供展示
- **等宽字体**：使用 `font-mono` 以清晰区分字符（如 `l` vs `1`）
- **可复制**：右侧复制按钮，点击后图标变为 CheckIcon（1.5s 后恢复）
- **统一样式**：`bg-muted` 背景标识不可编辑状态

## 使用方式

```tsx
import { KeyField } from "@/components/ui/key-field";

// 从 prop 传值
<KeyField value={datasetKey} />

// 从 form 取值
<KeyField value={form.getValues("key")} />
```

## 适用场景

所有资源详情页的 key 字段：Tool、Function、Dataset、Component、Schema、ObjectType。
