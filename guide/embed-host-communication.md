# 嵌入式 Widget 宿主通信

本文档描述如何让嵌入式 Widget 与宿主页面进行双向通信，实现：

- **宿主上下文注入**：将宿主页面的状态（当前页面、用户信息等）注入 AI 的系统提示词
- **宿主工具执行**：AI 可以调用在宿主页面上执行的工具（加入购物车、页面跳转等）

> 前置阅读：[嵌入式 Widget 使用指南](embed-widget.md)

---

## 架构概览

```
宿主页面                          Archon iframe
┌────────────────────────┐       ┌────────────────────────┐
│  widget.js             │       │  /embed/[agentId]      │
│                        │       │                        │
│  ArchonEmbed           │       │  接收 context          │
│    .setContext({...})  ─┼──────▶│  → 附加到 API 请求     │
│    .registerTools({    │       │                        │
│       name: handler    │       │  收到 tool call        │
│    })                 ◀┼───────┼─  → postMessage 转发   │
│    执行 handler        │       │                        │
│    返回结果           ─┼──────▶│  → addToolOutput()     │
│                        │       │  → AI 继续对话         │
└────────────────────────┘       └────────────────────────┘
         postMessage 双向通信
```

通信全部通过 iframe 的 `postMessage` 完成，无需额外 API 端点或 CORS 配置。

---

## 快速开始

### 基础嵌入（无宿主通信）

```html
<script
  src="https://your-archon-domain.com/embed/widget.js"
  data-agent-id="your-agent-id"
  data-token="et_xxxxxxxxxxxxxxxx"
></script>
```

### 完整示例（含宿主通信）

```html
<script
  src="https://your-archon-domain.com/embed/widget.js"
  data-agent-id="your-agent-id"
  data-token="et_xxxxxxxxxxxxxxxx"
></script>

<script>
  // 1. 注入宿主上下文 → 系统提示词模板变量
  ArchonEmbed.setContext({
    currentPage: location.pathname,
    userName: '张三',
    userRole: 'premium',
    cartItems: 3
  });

  // 2. 注册宿主工具 Handler → AI 可调用
  ArchonEmbed.registerTools({
    addToCart: async ({ productId, quantity }) => {
      await myApp.cart.add(productId, quantity);
      return { success: true, newTotal: myApp.cart.total };
    }
  });
</script>
```

---

## 宿主上下文（Host Context）

宿主上下文允许你将宿主页面的动态状态传递给 AI，作为系统提示词的模板变量。

### 宿主端：设置上下文

```javascript
ArchonEmbed.setContext({
  currentPage: '/products/123',
  userName: '张三',
  userRole: 'premium',
  cartItems: 3,
  productName: 'iPhone 16 Pro',
  locale: 'zh-CN'
});
```

- 可以在**任意时机**调用，多次调用会**合并**（shallow merge）
- 值支持 `string`、`number`、`boolean`，不支持嵌套对象
- 每次用户发送消息时，当前 context 快照会随请求发送到后端

### 动态更新

页面状态变化时随时更新：

```javascript
// SPA 路由切换
router.on('change', (path) => {
  ArchonEmbed.setContext({ currentPage: path });
});

// 购物车变化
cart.on('update', () => {
  ArchonEmbed.setContext({ cartItems: cart.items.length });
});

// 用户登录
auth.on('login', (user) => {
  ArchonEmbed.setContext({
    userName: user.name,
    userRole: user.role
  });
});
```

### Dashboard 端：在系统提示词中使用

上下文值通过 **`host.*` 命名空间** 在模板中引用，语法与现有 Liquid 模板引擎完全一致：

```liquid
你是商城客服助手。

当前页面：{{ host.currentPage }}
用户名：{{ host.userName }}
当前商品：{{ host.productName }}

{% if host.userRole == "premium" %}
该用户是高级会员，可享受 9 折优惠。
{% endif %}

{% if host.cartItems > 0 %}
用户购物车有 {{ host.cartItems }} 件商品，可以主动询问是否需要结算。
{% endif %}
```

### 与 Dataset 的关系

| | Dataset | Host Context |
|---|---------|-------------|
| 数据来源 | Dashboard 静态配置 | 宿主页面运行时传入 |
| 模板命名空间 | `{{ datasetKey }}` 或 `{{ datasetKey.field }}` | `{{ host.fieldName }}` |
| 适用场景 | 固定配置、业务规则、知识条目 | 用户状态、页面信息、动态数据 |
| 更新方式 | Dashboard 手动编辑 | `setContext()` 实时更新 |

两者可以同时使用，互不冲突。`host` 是保留的命名空间，Dataset 中不应创建 key 为 `host` 的数据集。

### 注意事项

- 上下文总大小限制为 **10 KB**（序列化后），超出会被截断
- 不要传递敏感信息（密码、Token 等），上下文会被写入系统提示词
- `host` 命名空间是保留的，仅由宿主通信自动填充，不会与其他 Dataset 冲突
- 如果宿主未调用 `setContext()`，所有 `{{ host.* }}` 变量会渲染为空字符串

---

## 宿主工具（Host Tools）

宿主工具允许 AI 在对话中调用宿主页面上的功能（如加入购物车、页面导航、展示弹窗等）。

### 工作原理

宿主工具的**定义**（名称、描述、参数 Schema）在 Dashboard 配置，**执行**由宿主页面完成：

```
Dashboard 定义工具 schema     宿主注册 handler
       ↓                         ↓
AI 看到工具，决定调用  →  iframe 转发  →  宿主执行  →  结果返回给 AI
```

这与现有的 server / client 工具是同一套系统，只是执行位置不同：

| 执行目标 | 工具定义 | Handler 来源 | 执行位置 |
|---------|---------|-------------|---------|
| `server` | Dashboard | Dashboard（URL 或 JS） | 后端 |
| `client` | Dashboard | Dashboard（JS） | iframe 内 |
| **`host`** | Dashboard | **宿主页面注册** | **宿主页面** |

### 第一步：Dashboard 定义工具

在 Agent 的 **Settings → Tools** 中创建工具：

| 字段 | 值 |
|-----|---|
| Name | `addToCart` |
| Description | `将指定商品加入用户的购物车` |
| Parameters | `productId` (string, required)、`quantity` (number, required) |
| Execution Target | **Host** |
| Handler | （留空，由宿主提供） |

参数 Schema 定义了 AI 调用时传递的参数结构。描述要写清楚——AI 依赖这些信息来判断何时以及如何调用工具。

### 第二步：宿主注册 Handler

```javascript
ArchonEmbed.registerTools({
  // key 必须与 Dashboard 中定义的工具 Name 完全一致
  addToCart: async ({ productId, quantity }) => {
    const result = await myApp.cart.add(productId, quantity);
    // 同时更新上下文，让 AI 知道最新状态
    ArchonEmbed.setContext({ cartItems: myApp.cart.items.length });
    return { success: true, newTotal: result.total };
  },

  navigateTo: async ({ url }) => {
    window.location.href = url;
    return { navigated: true };
  },

  showNotification: async ({ message, type }) => {
    myApp.toast(message, { type });
    return { shown: true };
  }
});
```

Handler 规则：
- 函数签名：`async (params) => result`
- `params` 是 AI 根据 Schema 生成的参数对象
- 返回值会作为工具执行结果传回给 AI
- 抛出异常会被捕获，错误信息传回给 AI
- 超时时间 30 秒，超时视为失败

### 匹配机制

Widget 加载后会将宿主已注册的工具名称列表通知 iframe。只有**同时满足以下条件**的工具才会对 AI 可见：

1. Dashboard 中定义了该工具，且 `executionTarget = "host"`
2. 宿主页面通过 `registerTools()` 注册了同名 handler

如果 Dashboard 定义了 `addToCart` 但宿主没有注册 handler，AI 不会看到这个工具。

### 完整对话示例

假设 Dashboard 已定义 `addToCart` 和 `navigateTo` 两个 host 工具：

```
用户：我想买这个 iPhone 16 Pro，帮我加到购物车

AI （内部决策）：调用 addToCart({ productId: "iphone-16-pro", quantity: 1 })
  → iframe 收到 tool call
  → postMessage 转发给宿主
  → 宿主执行 myApp.cart.add(...)
  → 返回 { success: true, newTotal: 8999 }

AI：已经帮你把 iPhone 16 Pro 加入购物车了！当前购物车总计 ¥8,999。需要去结算吗？

用户：好，去结算

AI （内部决策）：调用 navigateTo({ url: "/checkout" })
  → 宿主执行 window.location.href = "/checkout"
  → 返回 { navigated: true }

AI：正在跳转到结算页面...
```

---

## Widget JavaScript API

### `ArchonEmbed.setContext(data)`

设置或更新宿主上下文。

```javascript
ArchonEmbed.setContext({
  currentPage: '/products/123',
  userName: '张三'
});

// 后续调用会合并（shallow merge），不会覆盖未提及的字段
ArchonEmbed.setContext({ cartItems: 5 });
// 此时 context = { currentPage: '/products/123', userName: '张三', cartItems: 5 }
```

| 参数 | 类型 | 说明 |
|-----|------|------|
| `data` | `Record<string, string \| number \| boolean>` | 上下文键值对 |

### `ArchonEmbed.registerTools(handlers)`

注册宿主工具的执行 handler。

```javascript
ArchonEmbed.registerTools({
  toolName: async (params) => {
    // 执行逻辑
    return { /* 结果 */ };
  }
});
```

| 参数 | 类型 | 说明 |
|-----|------|------|
| `handlers` | `Record<string, (params: object) => Promise<unknown>>` | 工具名 → handler 映射 |

- 多次调用会合并，同名 handler 后者覆盖前者
- handler 必须是 async 函数（或返回 Promise）
- 工具名必须与 Dashboard 中定义的工具 Name 一致

### `ArchonEmbed.on(event, callback)`

监听 Widget 事件。

```javascript
ArchonEmbed.on('ready', () => {
  console.log('Widget 已就绪');
});

ArchonEmbed.on('open', () => {
  console.log('聊天窗口已打开');
});

ArchonEmbed.on('close', () => {
  console.log('聊天窗口已关闭');
});

ArchonEmbed.on('message', (msg) => {
  console.log(`${msg.role}: ${msg.content}`);
});
```

| 事件 | 回调参数 | 触发时机 |
|------|---------|---------|
| `ready` | 无 | iframe 加载完成，通信就绪 |
| `open` | 无 | 用户打开聊天窗口 |
| `close` | 无 | 用户关闭聊天窗口 |
| `message` | `{ role: 'user' \| 'assistant', content: string }` | 新消息产生 |

### `ArchonEmbed.open()` / `ArchonEmbed.close()`

程序化控制聊天窗口的开关。

```javascript
// 满足某个条件时自动弹出聊天
if (user.isNewVisitor) {
  ArchonEmbed.open();
}
```

---

## 通信协议（postMessage）

> 本节面向需要了解内部实现的开发者，普通集成不需要直接使用 postMessage。

所有消息的 `type` 以 `archon:` 为前缀，避免与其他库冲突。

### 宿主 → iframe

| type | payload | 说明 |
|------|---------|------|
| `archon:context` | `{ data: Record<string, unknown> }` | 设置/更新宿主上下文 |
| `archon:tools-register` | `{ names: string[] }` | 通知 iframe 宿主已注册的工具名称列表 |
| `archon:tool-result` | `{ callId: string, result: unknown }` | 工具执行成功，返回结果 |
| `archon:tool-error` | `{ callId: string, error: string }` | 工具执行失败，返回错误 |

### iframe → 宿主

| type | payload | 说明 |
|------|---------|------|
| `archon:ready` | 无 | iframe 加载完毕，可以开始通信 |
| `archon:tool-call` | `{ callId: string, toolName: string, params: object }` | 请求宿主执行工具 |
| `archon:chat-open` | 无 | 聊天窗口被打开 |
| `archon:chat-close` | 无 | 聊天窗口被关闭 |
| `archon:message` | `{ role: string, content: string }` | 新消息产生 |

### 时序图

```
宿主页面                    widget.js                   iframe
  │                           │                           │
  │  <script> 加载            │                           │
  │─────────────────────────▶│                           │
  │                           │  创建 iframe              │
  │                           │──────────────────────────▶│
  │                           │                           │
  │                           │       archon:ready        │
  │                           │◀──────────────────────────│
  │                           │                           │
  │  setContext({...})        │    archon:context          │
  │──────────────────────────▶│──────────────────────────▶│
  │                           │                           │
  │  registerTools({...})     │  archon:tools-register    │
  │──────────────────────────▶│──────────────────────────▶│
  │                           │                           │
  │                           │  用户发送消息              │
  │                           │  POST /api/embed/chat     │
  │                           │  { messages, hostContext,  │
  │                           │    registeredHostTools }   │
  │                           │                           │
  │                           │  AI 调用 host tool         │
  │                           │                           │
  │    archon:tool-call       │                           │
  │◀──────────────────────────│◀──────────────────────────│
  │                           │                           │
  │  执行 handler             │                           │
  │  ......                   │                           │
  │                           │                           │
  │    archon:tool-result     │                           │
  │──────────────────────────▶│──────────────────────────▶│
  │                           │      addToolOutput()      │
  │                           │      AI 继续对话          │
```

---

## 完整集成示例

### 电商客服场景

```html
<!DOCTYPE html>
<html>
<head>
  <title>我的商城</title>
</head>
<body>
  <!-- 页面内容 -->
  <div id="product-detail">
    <h1>iPhone 16 Pro</h1>
    <p>价格：¥8,999</p>
    <button onclick="addToCart('iphone-16-pro')">加入购物车</button>
  </div>

  <!-- 嵌入 Widget -->
  <script
    src="https://your-archon-domain.com/embed/widget.js"
    data-agent-id="your-agent-id"
    data-token="et_xxxxxxxxxxxxxxxx"
  ></script>

  <script>
    // 注入页面上下文
    ArchonEmbed.setContext({
      currentPage: location.pathname,
      productName: document.querySelector('h1').textContent,
      productPrice: 8999,
      userName: getCurrentUser()?.name || '访客',
      userRole: getCurrentUser()?.role || 'guest',
      cartItems: getCart().length
    });

    // 注册宿主工具
    ArchonEmbed.registerTools({
      addToCart: async ({ productId, quantity }) => {
        const result = await fetch('/api/cart/add', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity })
        }).then(r => r.json());

        // 执行后更新上下文
        ArchonEmbed.setContext({ cartItems: result.cartSize });
        return { success: true, cartSize: result.cartSize };
      },

      getProductInfo: async ({ productId }) => {
        const product = await fetch(`/api/products/${productId}`).then(r => r.json());
        return {
          name: product.name,
          price: product.price,
          stock: product.stock,
          description: product.description
        };
      },

      navigateTo: async ({ path }) => {
        window.location.href = path;
        return { navigated: true };
      }
    });

    // 新用户自动弹出
    ArchonEmbed.on('ready', () => {
      if (isNewVisitor()) {
        setTimeout(() => ArchonEmbed.open(), 3000);
      }
    });
  </script>
</body>
</html>
```

对应的 Dashboard 系统提示词：

```liquid
你是「我的商城」的智能客服助手。

## 当前上下文
- 页面：{{ host.currentPage }}
- 用户：{{ host.userName }}（{{ host.userRole }}）
- 购物车：{{ host.cartItems }} 件商品

{% if host.productName %}
用户正在浏览商品「{{ host.productName }}」，售价 ¥{{ host.productPrice }}。
{% endif %}

## 行为规范
- 主动询问用户需求，推荐当前浏览的商品
- 使用 addToCart 工具帮助用户加入购物车
- 使用 getProductInfo 工具查询商品详情
- 如果用户想去其他页面，使用 navigateTo 工具跳转
{% if host.userRole == "premium" %}
- 该用户是高级会员，主动告知可享受 9 折优惠
{% endif %}
```

Dashboard 工具定义：

| 工具 | 描述 | 参数 | 执行目标 |
|-----|------|------|---------|
| `addToCart` | 将商品加入购物车 | productId (string), quantity (number) | Host |
| `getProductInfo` | 查询商品详情 | productId (string) | Host |
| `navigateTo` | 跳转到指定页面 | path (string) | Host |

---

## 安全与限制

### Origin 验证

所有 postMessage 通信都会严格验证消息来源（origin），防止恶意页面伪造消息：

**iframe 侧**（Archon 服务）：
- iframe 只接受来自**已注册 Embed Token 的 `allowedOrigins`** 中的域名的 postMessage
- 如果 Token 未设置 `allowedOrigins`（即允许所有域名），则接受任意来源
- 不在白名单中的来源发送的消息会被静默丢弃

**宿主侧**（widget.js）：
- widget.js 只接受来自 **Archon 服务域名** 的 postMessage（即 `<script src>` 中的域名）
- 其他来源的消息会被静默丢弃

**实际效果**：即使恶意脚本注入了宿主页面，它也无法向 iframe 发送伪造的 `archon:context` 或 `archon:tool-result` 消息，因为 iframe 会校验 origin 是否在 Token 白名单中。

> **建议**：生产环境务必在创建 Embed Token 时设置 `allowedOrigins`，不要使用通配符。

### Host Context 限制

| 限制项 | 值 | 说明 |
|-------|---|------|
| 总大小 | **10 KB**（JSON 序列化后） | 超出部分会被截断，API 返回 warning |
| 值类型 | `string`、`number`、`boolean` | 不支持嵌套对象、数组 |
| Key 命名 | 仅 `[a-zA-Z0-9_]` | 不合法的 key 会被忽略 |
| 更新频率 | 无限制 | 但只在发送消息时生效 |

**不要在 context 中传递敏感信息**（密码、Token、密钥等），因为 context 会被完整写入系统提示词，发送给 AI 模型。

### Host Tool 执行限制

| 限制项 | 值 | 说明 |
|-------|---|------|
| 执行超时 | **30 秒** | 超时后 iframe 会向 AI 返回超时错误，AI 可能重试或向用户说明 |
| 返回值大小 | **100 KB**（JSON 序列化后） | 超出会截断 |
| 并发调用 | 无限制 | AI 可能同时调用多个工具，宿主 handler 应能处理并发 |
| 错误处理 | 自动捕获 | handler 抛出的异常会被 widget.js 捕获，错误 message 传回给 AI |

**超时处理流程**：

```
AI 调用 addToCart(...)
  → iframe 发送 archon:tool-call
  → 启动 30 秒倒计时
  → 30 秒内未收到 archon:tool-result / archon:tool-error
  → iframe 向 AI 返回: { error: "Tool execution timed out after 30s" }
  → AI 收到错误，决定如何回复用户（通常会告知操作失败）
```

### 工具可见性：双重匹配

Host 工具必须同时满足以下两个条件，AI 才能看到并调用它：

1. **Dashboard 中定义**：工具在 Settings → Tools 中创建，`executionTarget` 设为 `Host`
2. **宿主已注册 Handler**：宿主调用 `ArchonEmbed.registerTools({ toolName: handler })` 注册了同名 handler

| Dashboard 定义 | 宿主注册 Handler | AI 是否可见 |
|---------------|----------------|-----------|
| 有 | 有 | 可见，可调用 |
| 有 | **无** | **不可见** |
| **无** | 有 | **不可见**（宿主注册了但 Dashboard 没定义，会被忽略） |
| 无 | 无 | 不可见 |

这确保了：
- Agent 创建者通过 Dashboard 控制工具的 Schema 和描述（AI 看到什么）
- 宿主开发者通过代码控制工具的实际执行逻辑（工具做什么）
- 两侧必须对齐，缺一不可

---

## 常见问题

### setContext 什么时候调用？

越早越好。建议在 `<script>` 标签之后立即调用。如果在用户发送第一条消息之前还没有设置 context，`{{ host.* }}` 变量会渲染为空字符串。

### registerTools 可以延迟调用吗？

可以。但在注册之前，对应的 host 工具不会出现在 AI 的可用工具列表中。建议在页面加载时尽早注册。

### context 更新后，已经发送的系统提示词会变吗？

不会。每次用户发送消息时，才会用**当前 context 快照**重新渲染系统提示词。已经进行中的对话不受影响，下一条消息开始生效。

### host 工具和 client 工具有什么区别？

| | Client 工具 | Host 工具 |
|---|-----------|---------|
| Handler 来源 | Dashboard 中编写 JS 代码 | 宿主开发者通过 `registerTools()` 注册 |
| 执行位置 | iframe 内部 | 宿主页面 |
| 能否访问宿主 DOM | 不能 | 能 |
| 能否调用宿主 API | 不能（跨域限制） | 能（同源） |
| 适用场景 | 通用逻辑（格式化、计算等） | 需要与宿主页面交互的业务逻辑 |

### handler 抛出异常会怎样？

异常会被 widget.js 自动捕获，错误的 `message` 字段通过 `archon:tool-error` 传回 iframe，AI 会收到类似 `{ error: "Cannot read property 'add' of undefined" }` 的信息。AI 通常会据此向用户解释操作失败的原因。

### 同一个工具能否同时定义为 server 和 host？

不能。每个工具只有一个 `executionTarget`。如果你需要在服务端和宿主页面都能执行类似逻辑，应创建两个独立的工具。

### 页面导航（SPA 路由切换）后 context 还在吗？

如果是 SPA 内部路由切换（不刷新页面），context 保持不变——但你应该主动调用 `setContext()` 更新 `currentPage` 等值。如果是整页刷新，context 会丢失，需要重新设置。

### 多个 iframe 嵌入同一页面会冲突吗？

不会。每个 widget.js 实例维护独立的 context 和 tool handlers，postMessage 通过 iframe 引用精确投递，互不干扰。
