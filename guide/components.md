# 组件（Components）使用指南

组件是工具调用结果的可视化渲染器。当 AI 调用工具返回数据后，组件负责将原始 JSON 数据渲染为用户友好的 UI 界面。组件以 JSX 函数形式存储在数据库中，支持 Tailwind CSS 和内置 UI 组件库。

---

## 打开组件面板

进入 Agent 的 **Settings** 页面，选择 **Components** 标签页。

面板采用左右分栏布局：
- **左侧**：组件列表 + 新建按钮
- **右侧**：选中组件的详情编辑

---

## 创建组件

1. 点击左侧列表底部的 **New** 按钮
2. 在弹窗中填写：
   - **Key**（必填）：唯一标识符，只允许小写字母、数字和下划线（输入时自动格式化）。例如 `pricing_result`
   - **Name**（可选）：显示名称，默认从 Key 自动生成。例如 Key 为 `pricing_result` 会自动生成 `Pricing Result`
3. 点击 **Create**

---

## 编辑组件

### 基本信息

- **Key**：创建后只读，不可修改
- **Name**：组件显示名称
- **Description**：组件用途描述

### 组件源码（Component Source）

JSX 编辑器中编写组件的渲染逻辑。支持两种写法：

**完整函数形式**（推荐）：

```jsx
function PricingResult({ output, isLoading }) {
  if (isLoading) return <Spinner className="size-4" />;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-lg font-semibold">{output.plan}</h3>
      <span className="text-2xl font-bold text-primary">{output.price}</span>
    </div>
  );
}
```

**JSX 片段形式**（简单场景）：

```jsx
<div className="p-4">
  <p>{output.result}</p>
</div>
```

片段形式会自动被包装为函数，注入所有可用 props。

### 注入的 Props

组件函数会收到以下 props：

| Prop | 类型 | 说明 |
|------|------|------|
| `toolName` | `string` | 工具名称 |
| `state` | `string` | 当前状态：`input-streaming`、`input-available`、`output-available`、`error` |
| `input` | `unknown` | 工具调用的输入参数 |
| `output` | `unknown` | 工具返回的结果数据 |
| `isLoading` | `boolean` | 是否正在加载（等待工具返回） |
| `isComplete` | `boolean` | 工具调用是否已完成 |
| `isError` | `boolean` | 工具调用是否出错 |

典型用法：

```jsx
function MyComponent({ output, isLoading, isError }) {
  if (isLoading) return <Spinner className="size-4" />;
  if (isError) return <p className="text-destructive">出错了</p>;
  return <div>{output.message}</div>;
}
```

### 可用的依赖

在组件源码中可以直接使用以下依赖，无需 import：

**React**：
`React`、`useState`、`useMemo`、`useCallback`、`useEffect`、`useRef`、`Fragment`

**UI 组件**：
- `Badge` — 标签徽章
- `Spinner` — 加载动画
- `Table`、`TableBody`、`TableCell`、`TableHead`、`TableHeader`、`TableRow` — 表格
- `Tooltip`、`TooltipContent`、`TooltipTrigger` — 提示气泡
- `CollapsibleSection` — 可折叠区域
- `ResultHeader`、`ResultSection` — 结果展示布局

**图标**：
`ChevronRight`、`FileText`

### Mock Data

JSON 格式的模拟数据，用于编辑器中的实时预览。编辑 Mock Data 后预览面板会即时更新渲染效果。

示例：

```json
{
  "plan": "专业版",
  "price": "¥299/月",
  "features": ["无限项目", "团队协作", "优先支持"]
}
```

预览时 Mock Data 会作为 `output` prop 传入组件。

---

## 关联工具

组件创建后，需要关联到工具才能在对话中生效：

1. 进入 **Settings → Tools** 标签页
2. 选择目标工具
3. 在表单底部的 **Component** 下拉框中选择对应的组件 Key
4. 保存

当 AI 调用该工具时，返回的数据会自动使用关联的组件渲染。

---

## Tailwind CSS 支持

组件源码中可以使用 Tailwind CSS 类名。由于组件存储在数据库中，无法被 Tailwind 构建时扫描，系统采用以下方案：

1. **保存时编译**：组件保存（创建或编辑）时，服务端使用 `@tailwindcss/node` 从源码中提取所有 Tailwind 类名并编译为 CSS
2. **入库存储**：编译后的 CSS 存入 `generatedCss` 字段
3. **运行时注入**：页面加载时将所有组件的 CSS 合并为一个 `<style>` 标签注入到页面

所有项目中已有的 Tailwind 类名和主题变量均可直接使用，包括自定义主题色（`bg-primary`、`text-muted-foreground` 等）。

---

## 示例：定价结果组件

完整示例，展示一个工具返回定价方案后的渲染组件：

**组件源码**：

```jsx
function PricingResult({ output, isLoading }) {
  if (isLoading) return <Spinner className="size-4" />;
  if (!output) return null;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{output.plan}</h3>
        <span className="text-2xl font-bold text-primary">{output.price}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {output.features?.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Mock Data**：

```json
{
  "plan": "专业版",
  "price": "¥299/月",
  "features": ["无限项目", "团队协作", "API 接入", "优先技术支持"]
}
```
