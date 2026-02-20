# 组件（Components）使用指南

组件是工具调用结果的可视化渲染器。当 AI 调用工具返回数据后，组件负责将原始 JSON 数据渲染为用户友好的 UI 界面。组件以 JSX 函数形式存储在数据库中，支持 Tailwind CSS 和内置 UI 组件库。

---

## 打开组件面板

进入 Agent 的 **Settings** 页面，选择 **Components** 标签页。

面板采用左右分栏布局：
- **左侧**：组件列表 + 新建按钮
- **右侧**：选中组件的详情（四个 Tab：Edit / Examples / Playground / Test Cases）

---

## 创建组件

1. 点击左侧列表底部的 **New** 按钮
2. 在弹窗中填写：
   - **Key**（必填）：唯一标识符，只允许小写字母、数字和下划线（输入时自动格式化）。例如 `pricing_result`
   - **Name**（可选）：显示名称，默认从 Key 自动生成。例如 Key 为 `pricing_result` 会自动生成 `Pricing Result`
3. 点击 **Create**

---

## 编辑组件（Edit Tab）

### 基本信息

- **Key**：创建后只读，不可修改
- **Name**：组件显示名称
- **Description**：组件用途描述

### Schema Ref（Input / Output）

可选关联 Schema，用于描述组件接收的工具数据结构。下拉选择当前 Agent 已定义的 Schemas。

- **Input Schema Ref**（可选）：关联一个 Schema，描述 `tool.input` 的数据结构
- **Output Schema Ref**（可选）：关联一个 Schema，描述 `tool.output` 的数据结构

Schema Ref 的作用：
- **Playground**：根据关联的 Schema 自动生成模拟数据的模板，方便快速测试
- **Test Cases**：为测试用例的 input/output 编辑器提供结构参考
- **文档化**：明确标注组件期望接收的数据结构，方便团队协作

### 组件源码（Component Source）

JSX 编辑器中编写组件的渲染逻辑。支持两种写法：

**完整函数形式**（推荐）：

```jsx
function PricingResult({ tool, isLoading }) {
  const { output } = tool;
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
  <p>{tool.output.result}</p>
</div>
```

片段形式会自动被包装为函数，注入 `tool`、`state`、`isLoading`、`isComplete`、`isError` 变量。

### 注入的 Props

组件函数会收到以下 props：

| Prop | 类型 | 说明 |
|------|------|------|
| `tool` | `{ name: string; input: unknown; output: unknown }` | 工具对象（聚合了 name/input/output） |
| `state` | `string` | 当前状态：`input-streaming`、`input-available`、`output-available`、`error` |
| `isLoading` | `boolean` | 是否正在加载（等待工具返回） |
| `isComplete` | `boolean` | 工具调用是否已完成 |
| `isError` | `boolean` | 工具调用是否出错 |

**JSX 片段中的便捷变量**：在片段形式中，以下变量自动可用，无需从 props 解构：
- `tool`、`state`、`isLoading`、`isComplete`、`isError`

典型用法：

```jsx
function MyComponent({ tool, isLoading, isError }) {
  if (isLoading) return <Spinner className="size-4" />;
  if (isError) return <p className="text-destructive">出错了</p>;
  return <div>{tool.output.message}</div>;
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

---

## Playground Tab

Playground 提供即时预览功能，用于快速测试组件的渲染效果。

### 使用方法

1. 在 **Tool** 区域填写模拟数据：
   - **Name**：工具名称（可选）
   - **Input (JSON)**：工具输入 JSON
   - **Output (JSON)**：工具输出 JSON
   - 可以从右上角的 **Load** 下拉菜单加载已有数据，菜单按 Examples 和 Test Cases 分组显示
2. 在 **State** 下拉框中选择组件状态：
   - `output-available`（默认）— isComplete=true
   - `input-streaming` — isLoading=true
   - `input-available` — isLoading=true
   - `error` — isError=true
   - 旁边的 Badge 会实时显示 `isLoading`、`isComplete`、`isError` 的派生值
3. 下方的 **Preview** 区域会实时渲染组件
4. 点击 **Refresh** 按钮强制刷新预览

### 保存为测试用例

在 Playground 中调试好数据后，可以直接保存为 Test Case：

1. 点击底部的 **Save** 按钮
2. 在弹出的 Dialog 中填写：
   - **Name**（必填）：测试用例名称
   - **Tags**（可选）：标签，回车添加
   - **Show as Example**（可选）：开启后同时作为 Example 展示
3. 点击 **Save** 保存

保存后，新的测试用例会立即出现在 Load 下拉菜单和 Test Cases Tab 中。

---

## Test Cases Tab

测试用例用于验证组件在各种数据场景下的渲染正确性。组件的测试在客户端执行：渲染无报错 = 通过，抛异常 = 失败。

### 创建测试用例

1. 点击底部的 **Add Test Case** 按钮
2. 填写：
   - **Name**：测试用例名称
   - **Tags**：标签（用于分组过滤）
   - **Tool Name**：工具名称
   - **Tool Input (JSON)**：工具输入 JSON
   - **Tool Output (JSON)**：工具输出 JSON
3. 点击 **Save**

### 运行测试

- **单个运行**：点击测试用例右侧的 ▶ 按钮
- **批量运行**：点击顶部工具栏的 **Run All** 按钮

运行结果会显示 Passed/Failed 状态和渲染耗时。

### 标签过滤

点击顶部的标签按钮可以只显示和运行特定标签的测试用例。

### 运行历史

每次 Run All 都会生成一条运行记录，保存在 **Runs** 区域。可以展开查看每个用例的详细结果，也可以删除历史记录。

### 标记为示例

展开任意测试用例，可以看到 **Show as Example** 开关。开启后，该测试用例会同时出现在 **Examples** Tab 中，作为组件的展示示例。切换开关会立即保存，无需额外点击 Save。

---

## Examples Tab

Examples 展示组件在真实数据下的渲染效果，方便快速预览组件样式和行为。

### 数据来源

Examples 的数据来自 **Test Cases**——只有被标记为 "Show as Example" 的测试用例才会在 Examples Tab 中展示。

### 使用方法

1. 进入 **Test Cases** Tab
2. 展开目标测试用例，开启 **Show as Example** 开关
3. 切换到 **Examples** Tab，即可看到该用例的渲染效果卡片

每个 Example 卡片包含：
- **标题**：测试用例名称
- **编辑按钮**（✏️）：点击展开编辑表单，可修改 Name、Tags、Show as Example、Tool Name、Tool Input/Output，编辑时预览区域实时更新
- **删除按钮**（🗑️）：点击弹出确认对话框，确认后删除该测试用例
- **渲染区域**：使用组件源码 + 测试用例的 tool 数据实时渲染

### 空状态

当没有任何测试用例被标记为 Example 时，面板会显示引导提示，引导用户去 Test Cases Tab 标记。

### 组合依赖

Examples 与 Playground 一样支持组件组合（composition）——如果当前组件依赖其他组件，会自动编译依赖图并正确渲染。

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
4. **表单展示**：Edit Tab 中以只读方式展示编译后的 CSS，保存后自动更新

种子数据入库时同样会自动调用 `compileCssForComponent()` 编译 CSS 并写入数据库。

所有项目中已有的 Tailwind 类名和主题变量均可直接使用，包括自定义主题色（`bg-primary`、`text-muted-foreground` 等）。

---

## 示例：定价结果组件

完整示例，展示一个工具返回定价方案后的渲染组件：

**组件源码**：

```jsx
function PricingResult({ tool, isLoading }) {
  const { output } = tool;
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

**测试用例数据**（在 Test Cases 中创建）：

- Tool Name: `get_pricing`
- Tool Input: `{}`
- Tool Output:
```json
{
  "plan": "专业版",
  "price": "¥299/月",
  "features": ["无限项目", "团队协作", "API 接入", "优先技术支持"]
}
```
