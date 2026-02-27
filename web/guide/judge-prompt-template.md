评测运行时发送给 Judge LLM 的**用户消息**模板，使用 LiquidJS 语法。

所有轮次对话完成后，对整个 case 进行一次性评审。通过 `mode` 变量区分三种模式。

### 可用变量

| 变量 | 说明 |
|------|------|
| `mode` | `"single"`、`"injected"` 或 `"sequential"`，由 case 的 mode 字段决定 |
| `user_input` | 首轮用户输入（single 模式下有意义） |
| `expected_output` | case 级期望输出，为空则为 `""` |
| `actual_response` | 最终 assistant 回复（single 模式下有意义） |
| `conversation` | 完整对话记录，格式为 `[User]: ...\n[Assistant]: ...` |

### 三种模式

| 模式 | 说明 |
|------|------|
| **single** | 单轮对话：发送一条用户消息，获取一条回复 |
| **injected** | 注入历史：预设多轮对话上下文，仅最后一轮发给 LLM 生成回复 |
| **sequential** | 逐轮对话：每轮依次发给 LLM，每轮可独立评审 |

### 默认逻辑

- **single**：展示 User Input + Actual Response + Expected Output（如有）
- **injected / sequential**：展示完整 Conversation + Expected Output（如有）

> 如需对 injected 和 sequential 做不同处理，可在自定义模板中用 `{% if mode == "injected" %}` 分支。
