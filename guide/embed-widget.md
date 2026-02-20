# 嵌入式聊天 Widget 使用指南

通过嵌入式 Widget，可以将 Agent 的聊天功能以 `<script>` 标签的方式嵌入到任意第三方网站，实现匿名访客聊天。

---

## 架构概览

```
第三方网站                         Archon 服务
┌──────────────────────┐       ┌──────────────────────┐
│  widget.js（气泡按钮） │       │  /embed/[agentId]    │
│  ↓ 点击后创建 iframe  │──────▶│  （简化版聊天 UI）     │
│                      │       │  ↓ 同源 API 调用      │
│                      │       │  /api/embed/chat      │
│                      │       │  /api/embed/config    │
└──────────────────────┘       └──────────────────────┘
```

- **气泡按钮**：原生 JS 渲染在宿主页面，无任何依赖
- **聊天窗口**：iframe 加载 Archon 的 `/embed/[agentId]` 页面
- **认证方式**：Embed Token（非 Clerk），支持匿名聊天
- **API 调用**：在 iframe 内部发起（同源），无需 CORS 配置

---

## 快速开始

### 1. 创建 Embed Token

1. 进入 Agent 的 **Settings** 页面
2. 选择 **Embed** 标签页
3. 点击 **New Token** 按钮
4. 填写名称（如 `Production`）和允许的域名（可选）
5. 点击 **Create**

### 2. 获取嵌入代码

1. 在 Token 列表中找到刚创建的 Token
2. 点击右侧的 **代码图标**（`</>`）
3. 复制弹窗中的 `<script>` 标签

### 3. 粘贴到网站

将复制的代码粘贴到目标网站的 HTML 中（通常在 `</body>` 之前）：

```html
<script
  src="https://your-archon-domain.com/embed/widget.js"
  data-agent-id="你的 Agent ID"
  data-token="et_xxxxxxxxxxxxxxxx"
></script>
```

页面右下角会出现聊天气泡按钮，点击即可对话。

---

## 配置选项

Widget 支持通过 `data-*` 属性自定义外观和行为：

| 属性 | 默认值 | 说明 |
|------|--------|------|
| `data-agent-id` | （必填） | Agent ID |
| `data-token` | （必填） | Embed Token |
| `data-position` | `bottom-right` | 气泡位置：`bottom-right`、`bottom-left`、`top-right`、`top-left` |
| `data-button-color` | `#6366f1` | 气泡按钮颜色（任意 CSS 颜色值） |
| `data-button-size` | `56` | 气泡按钮大小（px） |
| `data-width` | `400` | 聊天窗口宽度（px） |
| `data-height` | `600` | 聊天窗口高度（px） |

### 示例：自定义样式

```html
<script
  src="https://your-archon-domain.com/embed/widget.js"
  data-agent-id="xxx"
  data-token="et_xxx"
  data-position="bottom-left"
  data-button-color="#10b981"
  data-width="450"
  data-height="700"
></script>
```

---

## Token 管理

### 创建 Token

每个 Token 可以配置：
- **名称**：便于区分用途（如 Production、Staging）
- **允许的域名**：限制哪些域名可以使用该 Token（留空则允许所有域名）

### 启停 Token

通过 Token 列表中的开关可以随时启用/禁用 Token，无需删除。禁用后使用该 Token 的网站将无法加载聊天。

### 域名限制

允许的域名格式为完整 Origin（含协议），多个域名用逗号分隔：

```
https://example.com, https://www.example.com
```

留空表示允许所有域名。设置后，非允许域名发起的请求会返回 403。

---

## 聊天功能

嵌入式聊天与主站聊天共享以下能力：

- Agent 的系统提示词（System Prompt）
- 所有已启用的工具（包括服务端和客户端工具）
- 动态组件渲染（工具结果可视化）
- 聊天配置（欢迎页、快速操作、建议提问、占位符文本）
- 流式响应

### 与主站聊天的区别

| 特性 | 主站聊天 | 嵌入式聊天 |
|------|---------|-----------|
| 认证 | Clerk 登录 | Embed Token |
| 用户身份 | 已登录用户 | 匿名 |
| 会话历史 | 侧边栏浏览 | 无（sessionId 存 localStorage） |
| 分享 | 支持 | 不支持 |
| 导入/导出 | 支持 | 不支持 |
| 请求检查 | 支持 | 不支持 |
| Agent 设置 | 可跳转 | 不支持 |

---

## API 参考

### GET /api/embed/config

获取 Agent 配置信息（聊天配置、工具列表、组件）。

**请求头**：`Authorization: Bearer <token>`

### POST /api/embed/chat

发送聊天消息，返回流式响应。

**请求头**：`Authorization: Bearer <token>`

**请求体**：
```json
{
  "messages": [...],
  "sessionId": "uuid"
}
```

### Token CRUD

以下接口需要 Clerk 登录（editor 权限）：

- `GET /api/agents/{id}/embed-tokens` — 列出所有 Token
- `POST /api/agents/{id}/embed-tokens` — 创建 Token
- `PATCH /api/agents/{id}/embed-tokens/{tokenId}` — 更新 Token
- `DELETE /api/agents/{id}/embed-tokens/{tokenId}` — 删除 Token

---

## 安全注意事项

1. **Token 等同于访问密钥**：拥有 Token 即可以该 Agent 的身份进行聊天，请勿泄露到公开仓库
2. **建议设置域名限制**：生产环境建议填写允许的域名，防止 Token 被其他网站滥用
3. **可随时禁用**：如果发现 Token 泄露，可以立即在 Settings → Embed 中禁用或删除
4. **匿名用户**：嵌入式聊天不关联用户身份，会话记录的 userId 为空
