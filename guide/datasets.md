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

### Layer（层级）

| 层级 | 说明 | 何时使用 |
|------|------|---------|
| **0 — Base** | 基础层，存储原子值 | 常量、枚举映射、基础配置 |
| **1 — Derived** | 派生层，可引用 Layer 0 的数据 | 组合配置、业务规则 |

**Layer 0** 的数据是纯 JSON，不应包含模板语法。

**Layer 1** 的数据是 **Liquid 模板**，支持完整的模板语法（`{{key}}`、`{% for %}`、`{% if %}` 等），渲染后应产出合法 JSON。系统会先解析 Layer 0，再用其结果渲染 Layer 1。

### Data（编辑器）

编辑器根据 Layer 自动切换模式：

| Layer | 标签 | 语言模式 | 实时校验 |
|-------|------|---------|---------|
| **0 — Base** | Data (JSON) | JSON 语法高亮 | `JSON.parse` 实时验证 |
| **1 — Derived** | Data (Template) | Liquid 语法高亮（关键字紫色、变量蓝色） | 无实时验证（内容不是合法 JSON） |

编辑器提供两个 Tab：

- **Edit**：编辑文本。Layer 0 有实时 JSON 校验；Layer 1 无校验（因为模板语法不是合法 JSON）
- **Preview**：渲染模板后显示最终结果，并验证输出是否为合法 JSON。适用于 Layer 1 的模板调试

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

### 带变量引用的对象（Layer 1）

```json
{
  "universe": {
    "label": "GMCC Universe",
    "incomes": ["{{income_type_enum.w2}}", "{{income_type_enum.self_employed}}"]
  }
}
```

Layer 1 数据中的 `{{income_type_enum.w2}}` 会在渲染时替换为 Layer 0 中 `income_type_enum` 的对应值。

### 带控制流的模板（Layer 1）

Layer 1 支持完整 Liquid 语法，包括循环和条件：

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
