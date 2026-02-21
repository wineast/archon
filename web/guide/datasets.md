# 数据集（Datasets）使用指南

数据集是系统的统一数据存储，所有配置数据（枚举、常量、业务规则等）都存储为 JSON 格式的数据集条目。系统提示词、工具参数、模板渲染等功能均从数据集获取数据。

---

## 打开数据集面板

在 Agent 主页面的右上角菜单中，点击 **Datasets** 即可打开数据集管理面板。

面板采用左右分栏布局：
- **左侧**：数据集列表 + 新建按钮
- **右侧**：选中数据集的详情编辑

移动端自动切换为单栏视图，顶部有返回按钮。

---

## 创建数据集

1. 点击左侧列表底部的 **New Dataset** 按钮
2. 在弹窗中填写：
   - **Key**（必填）：唯一标识符，用于模板引用。只允许小写字母、数字和下划线，输入时自动格式化（空格和连字符转为下划线）。例如 `income_type_enum`
   - **Name**（可选）：显示名称，默认从 Key 自动生成。例如 Key 为 `income_type_enum` 会自动生成 `Income Type Enum`
3. 点击 **Create**

创建后自动跳转到该数据集的编辑页面，初始数据为空对象 `{}`。

---

## 编辑数据集

选中一个数据集后，右侧显示编辑表单，包含以下字段：

### Key（只读）

创建后不可修改，用于模板引用。

### Name

显示名称，可随时修改。

### Description

可选的描述文字，说明数据集的用途。

### Data（编辑器）

数据集的 Data 字段存储实际数据，支持纯 JSON 和 Liquid 模板语法。所有数据集都是平等的——任何数据集都可以包含模板语法、引用其他数据集，系统通过拓扑排序自动解决依赖顺序。

编辑器提供两个 Tab：

- **Edit**：编辑文本，支持模板变量补全
- **Preview**：渲染模板后显示最终结果，验证输出是否为合法 JSON

### AI 辅助编辑

Data 标签旁边有 **AI 编辑** 按钮（SparklesIcon），点击后打开 AI 辅助编辑弹窗：

- **左半边**：Diff 编辑器，显示 AI 修改前后的对比。支持模板变量补全
- **右半边**：AI 对话区，输入自然语言描述你想要的数据修改

AI 支持两种操作模式：
- **整体替换**（update_data）：适用于大范围重写
- **局部编辑**（edit_data）：适用于小范围修改，精确匹配并替换文本片段

AI 能正确处理 JSON 和 LiquidJS 模板语法。对话完成后点击 **Apply** 将修改应用到编辑器，或点击 **Cancel** 放弃修改

---

## 数据类型示例

### 简单字符串

```json
"GMCC"
```

模板引用：`{{company_name}}` → `GMCC`

### 枚举映射（对象）

```json
{
  "w2": "Full Doc - W2 Wage Earner",
  "self_employed": "NQM - 1year Self Employed",
  "bank_statement": "NQM - Bank Statement"
}
```

模板引用：`{{income_type_enum.w2}}` → `Full Doc - W2 Wage Earner`

### 列表（数组）

```json
["en", "zh", "es"]
```

模板中循环遍历：

```liquid
{% for lang in languages %}
- {{lang}}
{% endfor %}
```

### 带变量引用的对象

```json
{
  "universe": {
    "label": "GMCC Universe",
    "incomes": ["{{income_type_enum.w2}}", "{{income_type_enum.self_employed}}"]
  }
}
```

`{{income_type_enum.w2}}` 会在渲染时替换为 `income_type_enum` 数据集的对应值。

### 带控制流的模板

数据集支持完整 Liquid 语法，包括循环和条件：

```liquid
{
  "products": [
    {% for product in product_routes %}
    {
      "name": "{{product.name}}",
      "enabled": {% if product.active %}true{% else %}false{% endif %}
    }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]
}
```

这段模板渲染后会生成合法 JSON。编辑时编辑器不做 JSON 校验，可通过 Preview tab 验证渲染输出。

---

## 保存 / 重置 / 删除

底部操作栏：

- **Save**：保存当前修改（有未保存修改时可用）
- **Reset**：丢弃所有修改，恢复到上次保存的状态
- **Delete**：删除该数据集（不可撤销）

---

## 在模板中引用数据集

所有数据集通过 Key 直接引用，无需前缀：

```liquid
公司名称：{{company_name}}
收入类型：{{income_type_enum.w2}}
```

详细的模板语法请参考 [模板引擎文档](template-engine.md)。

---

## 在工具参数中引用

工具参数支持 `enumRef` 关联数据集：当参数类型为 `enum` 时，可以选择一个数据集作为枚举值来源，AI 调用工具时会自动约束参数值范围。

在工具编辑页面的参数行中：
1. 将参数类型设为 **enum**
2. 切换枚举来源为 **引用**
3. 从下拉列表选择一个对象类型的数据集

系统会自动将该数据集的值（对象的 value 或 key）作为可选枚举值。

---

## 保留字

以下 Key 不能用于数据集命名（被系统占用）：

- `tool`、`tool_names`、`tool_entries` — 工具命名空间
- `date`、`time`、`datetime`、`timestamp`、`year`、`month`、`day` — 内置时间变量
