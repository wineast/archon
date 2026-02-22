# Wiki 内容模板语法

Wiki 文档的 Content 编辑器支持 LiquidJS 模板语法，模板会在预览和运行时自动渲染。

可用变量请参考 sidebar 的「环境变量」面板。

---

## 变量插值

用双花括号引用数据：

```liquid
你好，欢迎使用 {{company_name}} 的服务。
今天是 {{date}}。
```

对象类型用点号访问子字段：

```liquid
{{income_type_enum.w2}}
```

### Wiki 专属变量

以下变量仅在 Wiki 文档中可用：

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `{{documentTitle}}` | `贷款指南` | 当前文档的标题 |
| `{{currentDate}}` | `2/17/2026` | 本地日期格式（en-US） |
| `{{currentTime}}` | `2:30:00 PM` | 本地时间格式（en-US） |

---

## 条件判断

```liquid
{% if bilingual %}
请使用双语回复。
{% endif %}
```

多分支：

```liquid
{% if role == "admin" %}
你拥有管理员权限。
{% elsif role == "editor" %}
你拥有编辑权限。
{% else %}
你拥有只读权限。
{% endif %}
```

反向判断：

```liquid
{% unless debug %}
这是生产环境。
{% endunless %}
```

---

## 循环

```liquid
{% for lang in languages %}
- {{lang}}
{% endfor %}
```

| 属性 | 说明 |
|------|------|
| `forloop.index` | 从 1 开始的序号 |
| `forloop.index0` | 从 0 开始的序号 |
| `forloop.first` | 是否第一项 |
| `forloop.last` | 是否最后一项 |

---

## 引用其他 Wiki 文档

```liquid
{% include 'document_key' %}
```

- 按文档 **key** 精确匹配（非标题），引号包裹
- 支持嵌套引用，系统自动检测循环引用

---

## Filter

```liquid
{{languages | join: "、"}}
{{company_name | upcase}}
{{description | truncate: 50}}
```

| Filter | 说明 |
|--------|------|
| `upcase` | 转大写 |
| `downcase` | 转小写 |
| `join` | 数组拼接为字符串 |
| `truncate` | 截断到指定长度 |
| `map` | 取数组每项的指定字段 |
| `split` | 字符串分割为数组 |
| `size` | 返回长度 |

> Wiki 文档使用标准 LiquidJS 引擎，不包含自定义 Filter（`json`/`keys`/`values` 仅在数据集和 Schema 中可用）。

---

## 注意事项

- **未定义变量**：引用不存在的变量会渲染为空，不会报错
- **语法错误**：模板语法有误时返回原始文本，不影响正常使用
- **保留字**：`tool`、`tool_entries` 不能用作数据集 key
