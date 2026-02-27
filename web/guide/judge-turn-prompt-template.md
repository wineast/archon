逐轮对话（sequential）模式下，每完成一轮独立评审一次时使用的模板（LiquidJS 语法）。

仅在 **sequential** 模式且某轮 turn 配置了 `expectedOutput` 时触发。single 和 injected 模式不使用此模板。

### 可用变量

| 变量 | 说明 |
|------|------|
| `mode` | 固定为 `"sequential"` |
| `user_input` | 当前轮的用户输入 |
| `expected_output` | 当前轮的期望输出 |
| `actual_response` | 当前轮的 assistant 回复 |
| `conversation` | 到当前轮为止的对话记录 |

### 默认逻辑

展示到当前轮为止的 Conversation + Expected Output（如有）。
