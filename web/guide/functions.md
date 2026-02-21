# 函数（Functions）使用指南

函数是可复用的 JavaScript 逻辑单元，用于封装数据转换、计算等操作。函数以代码形式存储在数据库中，支持参数 Schema 定义和自动化测试。

---

## 代码格式

函数支持两种代码格式，系统自动检测：

**旧格式（闭包注入）**：

```js
function fn({ compileExpression, other_fn }) {
  return function(input) {
    return other_fn({ value: compileExpression("x * 2")(input) });
  }
}
```

**新格式（ES6 模块）**：

```js
import { compileExpression } from "archon:lib/filtrex";
import other_fn from "archon:fn/other_fn";

export default function(input) {
  return other_fn({ value: compileExpression("x * 2")(input) });
}
```

新格式使用 `archon:*` 虚拟模块导入依赖，详见 [模块系统文档](module-system.md)。两种格式可在同一 Agent 内混用。

---

## 打开函数面板

进入 Agent 的 **Settings** 页面，选择 **Functions** 标签页。

面板采用左右分栏布局：
- **左侧**：函数列表 + 新建按钮
- **右侧**：选中函数的详情（四个 Tab：Edit / Examples / Playground / Test Cases）

---

## Playground Tab

Playground 提供即时执行功能，用于快速测试函数的输入输出。

### 使用方法

1. 在 **Input** 区域填写 JSON 输入数据
   - 可以从右上角的 **Load** 下拉菜单加载已有数据，菜单按 Examples 和 Test Cases 分组显示
2. 点击 **Run** 按钮执行函数
3. **Output** 区域展示执行结果或错误信息，右侧显示执行耗时

### 保存为测试用例

在 Playground 中调试好数据后，可以直接保存为 Test Case：

1. 点击底部的 **Save** 按钮
2. 在弹出的 Dialog 中填写：
   - **Name**（必填）：测试用例名称
   - **Tags**（可选）：标签，回车添加
   - **Show as Example**（可选）：开启后同时作为 Example 展示
3. 点击 **Save** 保存

保存时会自动将当前 Input 作为测试用例的 input，如果已有 Output 则作为 expectedOutput。

---

## Test Cases Tab

测试用例用于验证函数在各种输入场景下的输出正确性。函数的测试在服务端执行：实际输出与期望输出深度比较 = 通过，不匹配或抛异常 = 失败。

### 创建测试用例

1. 点击底部的 **Add Test Case** 按钮
2. 填写：
   - **Name**：测试用例名称
   - **Tags**：标签（用于分组过滤）
   - **Input (JSON)**：函数输入 JSON
   - **Expected Output (JSON)**：期望输出 JSON
3. 点击 **Save**

### 运行测试

- **单个运行**：点击测试用例右侧的 ▶ 按钮
- **批量运行**：点击顶部工具栏的 **Run All** 按钮

运行结果会显示 Passed/Failed/Error 状态和执行耗时。

### 标签过滤

点击顶部的标签按钮可以只显示和运行特定标签的测试用例。

### 运行历史

每次 Run All 都会生成一条运行记录，保存在 **Runs** 区域。可以展开查看每个用例的详细结果，也可以删除历史记录。

### 标记为示例

展开任意测试用例，可以看到 **Show as Example** 开关。开启后，该测试用例会同时出现在 **Examples** Tab 中，作为函数的展示示例。切换开关会立即保存，无需额外点击 Save。

---

## Examples Tab

Examples 以只读方式展示函数的典型输入输出，方便快速了解函数的用途和数据格式。

### 数据来源

Examples 的数据来自 **Test Cases**——只有被标记为 "Show as Example" 的测试用例才会在 Examples Tab 中展示。

### 使用方法

1. 进入 **Test Cases** Tab
2. 展开目标测试用例，开启 **Show as Example** 开关
3. 切换到 **Examples** Tab，即可看到该用例的数据卡片

每个 Example 卡片包含：
- **标题**：测试用例名称
- **Input**：只读 JSON 编辑器展示输入数据
- **Expected Output**：只读 JSON 编辑器展示期望输出数据（如有）

### 空状态

当没有任何测试用例被标记为 Example 时，面板会显示引导提示，引导用户去 Test Cases Tab 标记。
