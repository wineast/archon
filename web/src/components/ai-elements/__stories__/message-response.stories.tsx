import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";
import { Streamdown } from "streamdown";
import { MessageResponse } from "../message";

const meta = {
  title: "AI Elements/MessageResponse",
  component: MessageResponse,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-2xl rounded-lg border p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageResponse>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MarkdownLinks: Story = {
  name: "Markdown 链接",
  args: {
    children: `这是一段包含链接的 AI 回复：

- 参考文档：[Next.js 官方文档](https://nextjs.org/docs)
- API 参考：[Vercel AI SDK](https://sdk.vercel.ai/docs)
- 工具页面：[GitHub](https://github.com)

点击上面的链接应该在**新标签页**打开。`,
  },
};

export const HtmlLinks: Story = {
  name: "HTML 链接",
  args: {
    children: `AI 也可以输出 HTML 格式的链接：

<a href="https://example.com" target="_blank">Example 网站</a>

即使 target 属性被 sanitizer 剥掉，组件层也会重新注入。`,
  },
};

export const MixedContent: Story = {
  name: "混合内容",
  args: {
    children: `## 推荐资源

以下是一些有用的链接：

1. **入门教程** — [React 文档](https://react.dev)
2. **样式方案** — [Tailwind CSS](https://tailwindcss.com)
3. **邮件联系** — [发送邮件](mailto:support@example.com)（不会新窗口打开）

### 代码示例

\`\`\`typescript
const isExternal = href?.startsWith("https://");
\`\`\`

> 注意：\`mailto:\` 链接和锚点链接 **不会** 在新标签页打开，这是预期行为。`,
  },
};

export const SafetyDemo: Story = {
  name: "安全防护",
  args: {
    children: `## 链接安全测试

**安全链接**（新标签页打开）：
- [HTTPS 链接](https://example.com)
- [HTTP 链接](http://example.com)

**非外部链接**（当前窗口）：
- [邮件链接](mailto:test@example.com)
- [锚点链接](#section)
- [相对路径](/docs/guide)

**危险链接**（应被过滤）：
- <a href="javascript:alert('xss')">JavaScript 注入</a>

上面的 JavaScript 链接应该被 sanitizer 过滤掉 href。`,
  },
};

export const PlainText: Story = {
  name: "纯文本（无链接）",
  args: {
    children: `这是一段不包含任何链接的普通文本。

用来验证没有链接时渲染是否正常：
- **粗体**文字
- *斜体*文字
- \`行内代码\`
- 数学公式：$E = mc^2$`,
  },
};

const STREAMING_TEXT = `好的，以下是一些推荐的学习资源：

## 前端框架

1. **React** — [React 官方文档](https://react.dev) 是最好的入门教程
2. **Next.js** — [Next.js 文档](https://nextjs.org/docs) 覆盖了服务端渲染和路由

## 样式方案

- [Tailwind CSS](https://tailwindcss.com) — 实用优先的 CSS 框架
- [shadcn/ui](https://ui.shadcn.com) — 基于 Radix UI 的组件库

## 工具链

你还可以参考 [GitHub](https://github.com) 上的开源项目来学习最佳实践。

> 提示：点击上面的链接会在**新标签页**打开，不会中断当前对话。`;

function StreamingDemo() {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    setDone(false);
    setText("");
    const timer = setInterval(() => {
      i += 1 + Math.floor(Math.random() * 3);
      if (i >= STREAMING_TEXT.length) {
        setText(STREAMING_TEXT);
        setDone(true);
        clearInterval(timer);
      } else {
        setText(STREAMING_TEXT.slice(0, i));
      }
    }, 30);
    return () => clearInterval(timer);
  }, []);

  return (
    <div>
      <MessageResponse>{text}</MessageResponse>
      {done && (
        <p className="mt-4 text-xs text-muted-foreground">
          — 流式输出完成 —
        </p>
      )}
    </div>
  );
}

export const Streaming: Story = {
  name: "流式渲染",
  render: () => <StreamingDemo />,
};

const COMPARE_TEXT = `以下是推荐资源：

- [React 文档](https://react.dev)
- [Next.js 文档](https://nextjs.org/docs)
- [GitHub](https://github.com)
- [发送邮件](mailto:support@example.com)`;

export const Comparison: Story = {
  name: "默认 vs 自定义对比",
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Streamdown 默认渲染（无 components override）
        </p>
        <div className="rounded-lg border p-4">
          <Streamdown>{COMPARE_TEXT}</Streamdown>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          MessageResponse 自定义渲染（带样式 + 图标 + target=_blank）
        </p>
        <div className="rounded-lg border p-4">
          <MessageResponse>{COMPARE_TEXT}</MessageResponse>
        </div>
      </div>
    </div>
  ),
};
