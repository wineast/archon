# 测试指南

项目使用 **Vitest**（Layer 1-3）+ **Playwright Test**（Layer 4）的四层测试体系。

| 层 | 名称 | 运行器 | 环境 | 匹配规则 |
|----|------|--------|------|---------|
| **L1** | 纯逻辑单元测试 | Vitest | node | `src/**/__tests__/**/*.test.ts` |
| **L2** | 组件测试 | Vitest | jsdom | `src/**/__tests__/**/*.test.tsx` |
| **L3** | Story 交互测试 | Vitest | chromium (browser) | `src/**/*.stories.tsx`（自动） |
| **L4** | E2E 端到端测试 | Playwright Test | chromium | `e2e/**/*.spec.ts` |

运行命令：
- `make test` — Layer 1-3（Vitest）
- `make e2e` — Layer 4（Playwright）
- `make e2e-ui` — Layer 4 交互调试模式

---

## 四层测试模型

```
┌─────────────────────────────────────────────┐
│  Layer 4: E2E 端到端测试 (Playwright Test)   │  真实服务器
│  真实服务器 + 真实 DB + 真实 Auth             │  + 真实 Auth
├─────────────────────────────────────────────┤
│  Layer 3: Story 交互测试 (play function)     │  真实浏览器
│  真实 DOM + 真实渲染，验证用户交互流程        │  chromium
├─────────────────────────────────────────────┤
│  Layer 2: 组件测试 (Testing Library)         │  jsdom
│  mock 外部依赖，验证组件渲染与交互逻辑        │
├─────────────────────────────────────────────┤
│  Layer 1: 纯逻辑单元测试                     │  node
│  零 DOM，验证函数输入输出                     │
└─────────────────────────────────────────────┘
```

### 选择依据

| 要测什么 | 选哪层 | 原因 |
|---------|--------|------|
| 纯函数、解析器、渲染逻辑 | Layer 1 | 无 DOM 依赖，速度最快 |
| 组件渲染、按钮点击、表单交互 | Layer 2 | 需要 DOM 但可 mock 外部服务 |
| 真实 DOM 行为（Monaco Editor、拖拽、焦点） | Layer 3 | jsdom 不支持的 API 必须在真实浏览器测 |
| 视觉回归、样式一致性 | Layer 3 | 只有真实浏览器能渲染 CSS |
| 跨页面用户旅程、真实 API + DB | Layer 4 | 需要完整服务端栈，零 mock |

---

## Layer 1: 纯逻辑单元测试

**适用场景**：纯函数、工具函数、模板渲染、数据转换、业务规则

**特点**：
- 环境：node（默认），不需要 `@vitest-environment` 标记
- 无 DOM、无 React、无 mock（或极少 mock）
- 速度最快（毫秒级）

**文件位置**：`src/lib/**/__tests__/*.test.ts`

**示例**：模板变量解析

```ts
// src/lib/__tests__/template.test.ts
import { describe, it, expect } from "vitest";
import { resolveTemplate } from "../template";

describe("resolveTemplate", () => {
  it("resolves {{date}}", () => {
    expect(resolveTemplate("Today is {{date}}", {})).toMatch(
      /Today is \d{4}-\d{2}-\d{2}/
    );
  });

  it("resolves nested object access", () => {
    const vars = { user: { name: "Alice" } };
    expect(resolveTemplate("Hi {{user.name}}", vars)).toBe("Hi Alice");
  });
});
```

**示例**：自动补全逻辑

```ts
// src/components/editors/__tests__/completions.test.ts
import { describe, it, expect } from "vitest";
import { generateCompletions } from "../completions";

describe("generateCompletions", () => {
  it("returns completions when {{ is open", () => {
    const result = generateCompletions("{{", ["company_name"], [], []);
    expect(result).not.toBeNull();
  });

  it("returns null when no trigger", () => {
    expect(generateCompletions("hello", ["company_name"], [], [])).toBeNull();
  });
});
```

**何时用 Layer 1**：
- 函数签名明确，输入 → 输出可直接断言
- 不涉及 React 组件渲染
- 不依赖 DOM API（`document.querySelector` 等）

---

## Layer 2: 组件测试 (Testing Library + jsdom)

**适用场景**：React 组件渲染、按钮点击、表单填写、tab 切换、API mock 验证

**特点**：
- 环境：jsdom（文件顶部标记 `// @vitest-environment jsdom`）
- 使用 `@testing-library/react` 的 `render`、`screen`、`userEvent`
- 需要 mock 外部依赖（SWR hooks、API、第三方库）
- 速度中等（百毫秒级）

**文件位置**：`src/components/**/__tests__/*.test.tsx`

**示例**：Tab 切换 + API 调用

```tsx
// src/components/model-config/__tests__/model-config-detail.test.tsx
// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock 外部依赖
vi.mock("@/lib/tools/hooks", () => ({
  useTools: () => ({ tools: [], isLoading: false }),
}));

vi.mock("@/components/editors/md-editor", () => ({
  MdEditor: ({ value, onChange, placeholder }: any) => (
    <textarea
      data-testid="md-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

import { ModelConfigDetail } from "../model-config-detail";

describe("ModelConfigDetail tabs", () => {
  it("defaults to Edit tab", () => {
    render(<ModelConfigDetail config={baseConfig} onSave={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /edit/i }))
      .toHaveAttribute("data-state", "active");
  });

  it("fetches preview on tab click", async () => {
    const user = userEvent.setup();
    render(<ModelConfigDetail config={baseConfig} onSave={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /preview/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/template/preview",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
```

**何时用 Layer 2**：
- 需要验证组件渲染结果（元素存在、文本内容、属性值）
- 需要模拟用户交互（点击、输入、选择）
- 组件依赖的外部服务可以 mock（hooks、fetch、第三方库）
- 不需要真实 CSS 渲染或复杂 DOM API

**常见 mock 模式**：

```tsx
// Mock SWR hook
vi.mock("@/lib/datasets/hooks", () => ({
  useDatasets: () => ({ datasets: [], isLoading: false }),
}));

// Mock 复杂 UI 组件为简单替身
vi.mock("@/components/editors/md-editor", () => ({
  MdEditor: ({ value, onChange }: any) => (
    <textarea data-testid="md-editor" value={value}
      onChange={(e) => onChange(e.target.value)} />
  ),
}));

// Mock fetch
globalThis.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ data: [] }),
});
```

**jsdom 的局限**：
- 不支持 `Selection`、`Range` — Monaco Editor 等依赖选区的组件无法测
- 不支持 `ResizeObserver` — 需手动 polyfill（见 case-detail.test.tsx）
- 不支持真实 CSS 布局 — 无法测样式、滚动、定位
- 不支持 Canvas / WebGL

---

## Layer 3: Story 交互测试 (Storybook play function)

**适用场景**：真实浏览器中的交互测试、Monaco 编辑器、焦点管理、视觉回归

**特点**：
- 环境：真实 Chromium 浏览器（通过 `@vitest/browser-playwright`）
- 在 Storybook story 中定义 `play` 函数
- `storybookTest` 插件自动将每个 story 转为 vitest 测试用例
- 无需 mock — 组件在真实环境中渲染
- 速度最慢但最真实

**文件位置**：`src/components/__stories__/*.stories.tsx`

**示例**：编辑器焦点稳定性回归测试

```tsx
// src/components/editors/__stories__/json-editor.stories.tsx
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { JsonEditor } from "../json-editor";

const meta = {
  title: "Editors/JsonEditor",
  component: JsonEditor,
} satisfies Meta<typeof JsonEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 回归测试：templateVariables 变化不应导致编辑器重建
 * Monaco 使用 configRef 模式动态更新补全配置，不会触发编辑器重建
 * 手动验证：在编辑器中输入内容 → 点击按钮 → 确认内容不丢失
 */
export const KeepsFocusOnVarChange: Story = {
  render: () => {
    const [value, setValue] = useState("{}");
    const [vars, setVars] = useState(["a", "b"]);
    return (
      <div>
        <JsonEditor
          value={value}
          onChange={setValue}
          templateVariables={vars}
          height="200px"
        />
        <button data-testid="change-vars"
          onClick={() => setVars(["a", "b", "c"])}>
          Change variables
        </button>
        <pre data-testid="raw-value">{value}</pre>
      </div>
    );
  },
};
```

**play 函数 API**：

| 参数 | 说明 |
|------|------|
| `canvas` | `within(canvasElement)` 的返回值，用于查询 DOM |
| `userEvent` | Storybook 封装的 `@testing-library/user-event` |
| `expect` | 需从 `storybook/test` 导入 |

**注意事项**：
- `userEvent.keyboard` 中 `{` `}` 是特殊字符（修饰符语法），输入花括号需转义为 `{{}}`
- 没有 `play` 函数的 story 也会被自动测试（smoke test：验证渲染不报错）
- play 函数中的断言失败会导致 vitest 测试失败

**何时用 Layer 3**：
- 组件依赖真实 DOM API（Monaco Editor、contentEditable、Selection）
- 需要测试焦点管理、键盘导航
- 需要验证 CSS 渲染结果
- jsdom 中 mock 太多导致测试失去意义
- 需要同时作为 Storybook 文档展示

---

## Layer 4: E2E 端到端测试 (Playwright Test)

**适用场景**：跨页面用户旅程、真实 API 调用、真实数据库操作、登录/权限验证

**特点**：
- 运行器：`@playwright/test`（独立于 Vitest）
- 环境：真实 Next.js dev server + 真实 Clerk Auth + 真实数据库
- 零 mock — 测试完整系统集成
- 速度最慢但覆盖面最广

**文件位置**：`e2e/**/*.spec.ts`

**Auth 机制**：
- 使用 `@clerk/testing` 的 `clerkSetup()` + `clerk.signIn()` 绕过验证码
- 登录态通过 Playwright `storageState` 持久化，所有 `authenticated` project 的测试复用同一份登录 cookie
- 凭据从环境变量读取：`E2E_CLERK_USER_USERNAME` / `E2E_CLERK_USER_PASSWORD`（配置在 `.env.local`）

**项目配置**（`playwright.config.ts`）：
- `setup` project — 运行 `auth.setup.ts` 执行 Clerk 登录 + 保存 `.clerk/user.json`
- `authenticated` project — 依赖 setup，自动加载登录态
- `webServer` — 自动启动 dev server（worktree 感知端口）

**示例**：

```ts
// e2e/smoke.spec.ts
import { setupClerkTestingToken } from "@clerk/testing/playwright"
import { test, expect } from "@playwright/test"

test("authenticated user sees agents page", async ({ page }) => {
  await setupClerkTestingToken({ page })
  await page.goto("/")
  await expect(page).toHaveTitle(/archon/i)
  await expect(page.locator("header")).toBeVisible()
})
```

**Fixture 导入模式**：

对于需要预配置 Agent 的 E2E 测试，可通过 fixture 导入跳过手动创建步骤：

1. 在 `e2e/fixtures/<name>.json` 定义 Agent 快照（manifest 格式，含 tools、model config 等）
2. 测试中动态压缩为 ZIP 并通过 UI 导入：

```ts
import JSZip from "jszip"

const FIXTURE_JSON = path.resolve(__dirname, "fixtures/<name>.json")
const FIXTURE_ZIP = path.resolve(__dirname, "fixtures/.<name>.zip") // 点前缀，已 gitignore

async function buildFixtureZip() {
  const manifest = fs.readFileSync(FIXTURE_JSON, "utf-8")
  const zip = new JSZip()
  zip.file("manifest.json", manifest)
  const buf = await zip.generateAsync({ type: "nodebuffer" })
  fs.writeFileSync(FIXTURE_ZIP, buf)
}

// 测试中导入
await buildFixtureZip()
const fileInput = page.locator('input[type="file"][accept=".zip"]')
await fileInput.setInputFiles(FIXTURE_ZIP)
```

生成的 ZIP 文件使用 `.` 前缀（如 `.server-tool-agent.zip`），已在 `.gitignore` 中排除（`e2e/fixtures/.*.zip`）。

参考：`e2e/server-tool-regression.spec.ts`（首个使用 fixture 导入的 E2E 测试）。

**运行命令**：
- `make e2e` — 运行所有 E2E 测试
- `make e2e-ui` — Playwright UI 模式（交互式调试）

**何时用 Layer 4**：
- 需要验证完整用户旅程（登录 → 创建资源 → 编辑 → 删除）
- 需要验证真实 API 响应（不是 mock 数据）
- 需要验证跨页面状态传递
- 需要验证权限控制（不同角色看到不同内容）

---

## 决策流程图

```
需要测什么？
│
├─ 纯函数 / 数据转换 / 业务规则
│  → Layer 1（纯逻辑测试）
│
├─ React 组件行为
│  │
│  ├─ 组件可以在 jsdom 中正常渲染？
│  │  │
│  │  ├─ 是 → Layer 2（Testing Library + mock）
│  │  │
│  │  └─ 否（依赖 Monaco Editor/Canvas/真实布局）
│  │     → Layer 3（Story play function）
│  │
│  └─ 需要验证焦点/拖拽/动画等浏览器行为？
│     → Layer 3
│
├─ 跨页面用户旅程 / 真实 API + DB + Auth
│  → Layer 4（Playwright E2E）
│
└─ 回归测试
   │
   ├─ 可用简单断言描述 → Layer 1 或 Layer 2
   │
   ├─ 需要真实交互重现 → Layer 3
   │
   └─ 需要完整服务端环境 → Layer 4
```

---

## 最佳实践

### 1. 测试金字塔：数量分布

```
          ▲
         / \       Layer 4: 极少（核心用户旅程）
        /   \
       /─────\     Layer 3: 少量（关键交互路径）
      /       \
     /─────────\   Layer 2: 适量（核心组件行为）
    /           \
   /─────────────\ Layer 1: 大量（业务逻辑全覆盖）
  ─────────────────
```

Layer 1 数量最多、速度最快、维护成本最低。每往上一层，数量递减但保真度递增。

### 2. 测什么、不测什么

**应该测**：
- 业务逻辑（模板渲染、数据转换、定价引擎）
- 用户可见的交互行为（点击按钮后发生了什么）
- 边界情况和错误处理
- 回归 Bug（每个修复的 bug 补一个测试）

**不要测**：
- 第三方库的内部行为（不要测 Monaco Editor 的语法高亮是否正确）
- 纯样式（`className` 是否正确传递 — 除非是条件样式）
- 框架自带的功能（React 的 `useState` 是否工作）

### 3. Mock 原则

```
好的 mock 边界                     坏的 mock 边界
┌─────────────┐                  ┌─────────────┐
│  被测组件    │                  │  被测组件    │
│  ┌───────┐  │                  │  ┌───────┐  │
│  │ 内部  │  │  ← 不 mock       │  │ 内部  │  │  ← mock 了内部
│  │ 逻辑  │  │                  │  │ 逻辑  │  │    ❌ 测试变得无意义
│  └───────┘  │                  │  └───────┘  │
└──────┬──────┘                  └──────┬──────┘
       │                                │
  ┌────▼────┐   ← mock 这里        ┌────▼────┐
  │ 外部API │                      │ 外部API │   ← 没 mock
  │ SWR hook│                      │ SWR hook│     ❌ 测试不稳定
  │ fetch   │                      │ fetch   │
  └─────────┘                      └─────────┘
```

**Layer 2 mock 规则**：
- **Mock 什么**：SWR hooks、fetch API、复杂子组件（如 Monaco 编辑器）
- **不 mock 什么**：被测组件本身的逻辑、简单子组件（Button、Input）
- **Mock 的粒度**：mock 整个模块而非单个函数，用 `vi.mock("@/lib/xxx/hooks")` 而非 patch 单个方法

```tsx
// ✅ 好：mock 外部数据层
vi.mock("@/lib/datasets/hooks", () => ({
  useDatasets: () => ({ datasets: mockData, isLoading: false }),
}));

// ✅ 好：mock 不可测的复杂组件为简单替身
vi.mock("@/components/editors/md-editor", () => ({
  MdEditor: ({ value, onChange }: any) => (
    <textarea data-testid="md-editor" value={value}
      onChange={(e) => onChange(e.target.value)} />
  ),
}));

// ❌ 坏：mock 被测组件内部的 useState
vi.spyOn(React, "useState").mockReturnValue([...]);

// ❌ 坏：mock 太细，测试与实现耦合
vi.spyOn(component, "handleClick");
```

### 4. Layer 2 常见陷阱

**陷阱 1：忘记 jsdom 标记**

```ts
// ❌ 忘记标记 → 在 node 环境跑 → document is not defined
import { render } from "@testing-library/react";

// ✅ 文件首行加环境标记
// @vitest-environment jsdom
```

**陷阱 2：ResizeObserver 未 polyfill**

Radix UI 的 ScrollArea 等组件依赖 `ResizeObserver`，jsdom 没有：

```ts
// 在测试文件顶部（import 之前）
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
```

**陷阱 3：异步状态更新未等待**

```tsx
// ❌ 立即断言 — 可能在状态更新前
await user.click(button);
expect(screen.getByText("Done")).toBeInTheDocument();

// ✅ waitFor — 等待异步更新完成
await user.click(button);
await waitFor(() => {
  expect(screen.getByText("Done")).toBeInTheDocument();
});
```

**陷阱 4：mock 在 import 之后**

```tsx
// ❌ vi.mock 写在 import 之后看起来没问题，但 vitest 会自动提升 vi.mock
// 关键是：被测组件的 import 必须在 vi.mock 之后的代码行
vi.mock("@/lib/hooks", () => ({ useData: () => [] }));

// 组件 import 放在 mock 之后
import { MyComponent } from "../my-component";
```

### 5. Layer 3 常见陷阱

**陷阱 1：`userEvent.keyboard` 中的花括号**

```tsx
// ❌ { 是修饰符语法，会报错
await userEvent.keyboard('{"key": "value"}');

// ✅ 用 userEvent.type 代替（自动处理特殊字符）
await userEvent.type(element, "hello");

// ✅ 或手动转义花括号
await userEvent.keyboard("{{}key{}}");
```

**陷阱 2：依赖 story 渲染顺序**

play 函数中查询 DOM 时，确保组件已完成渲染：

```tsx
play: async ({ canvas, userEvent }) => {
  // ✅ 先等元素出现
  const button = await canvas.findByRole("button", { name: /submit/i });
  await userEvent.click(button);
};
```

**陷阱 3：story args 与 render 冲突**

使用 `render` 自定义渲染时，`args` 中的值不会自动传入：

```tsx
// ❌ args.onChange 不会传给 render 中的组件
export const MyStory: Story = {
  args: { onChange: fn() },  // 不生效
  render: () => {
    return <Editor onChange={() => {}} />;  // 用了自己的
  },
};

// ✅ render 函数接收 args
export const MyStory: Story = {
  args: { value: "", onChange: fn() },
  render: (args) => <Editor {...args} />,
};
```

### 6. 回归测试规范

每次修复 Bug 时：
1. **先写失败测试** — 用最小代码重现 bug
2. **选择正确的层** — 能在 Layer 1 重现就不要上 Layer 2
3. **测试名称说明 bug** — 不写 `it("works")`，写 `it("does not recreate editor when templateVariables change")`
4. **注释关联上下文** — 注释中说明 bug 的触发条件

```tsx
/**
 * 回归测试：templateVariables 变化不应导致编辑器重建
 * Bug: templateVariables 在 useEffect deps 中，数组引用变化 → 编辑器销毁重建 → 焦点丢失
 * Fix: Monaco 使用 configRef 模式，props 变化只更新 ref 值，不触发编辑器重建
 */
export const KeepsFocusOnVarChange: Story = { ... };
```

### 7. 文件组织

```
src/
├── lib/
│   ├── template/
│   │   ├── render.ts
│   │   └── __tests__/
│   │       └── render.test.ts        ← Layer 1
│   └── tools/
│       ├── schema-builder.ts
│       └── __tests__/
│           └── schema-builder.test.ts ← Layer 1
├── components/
│   ├── editors/
│   │   ├── completions.ts
│   │   ├── __tests__/
│   │   │   └── completions.test.ts           ← Layer 1
│   │   └── __stories__/
│   │       ├── json-editor.stories.tsx       ← Layer 3
│   │       └── md-editor.stories.tsx         ← Layer 3
│   ├── model-config/
│   │   ├── model-config-detail.tsx
│   │   └── __tests__/
│   │       └── model-config-detail.test.tsx  ← Layer 2
```

- Layer 1：与被测文件同目录的 `__tests__/` 下
- Layer 2：与被测组件同目录的 `__tests__/` 下（`.tsx`）
- Layer 3：统一放在 `components/__stories__/` 下
- Layer 4：统一放在 `e2e/` 下（`.spec.ts`）
