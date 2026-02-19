import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { JsEditor } from "../js-editor";

const meta = {
  title: "Editors/JsEditor",
  component: JsEditor,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JsEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    value: "",
    onChange: () => {},
    height: "200px",
  },
};

export const Basic: Story = {
  args: {
    value: `function hello(name) {
  return \`Hello, \${name}!\`;
}

const result = hello("World");
console.log(result);`,
    onChange: () => {},
    height: "200px",
  },
};

export const ToolHandler: Story = {
  args: {
    value: `async function handler({ args, context }) {
  const rates = await context.dataset.get("interest_rates");
  const doc = await context.wiki.get(args.docId);
  return {
    rates,
    title: doc.meta.title,
    content: doc.content,
  };
}`,
    onChange: () => {},
    height: "250px",
  },
};

export const WithJsx: Story = {
  args: {
    value: `function Component({ React, Spinner, Badge, Table, TableHeader, TableRow, TableHead, TableBody, TableCell }) {
  return function({ tool, isLoading }) {
  var output = tool.output;
  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-2">
      <Badge variant="outline">{output.status}</Badge>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {output.items?.map((item, i) => (
            <TableRow key={i}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
  }
}`,
    onChange: () => {},
    height: "400px",
  },
};

export const DifferentHeights: Story = {
  args: {
    value: "",
    onChange: () => {},
  },
  render: () => (
    <div className="space-y-4">
      {(["100px", "200px", "400px"] as const).map((h) => (
        <div key={h}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            height=&quot;{h}&quot;
          </p>
          <JsEditor
            value={`// Editor at ${h}\nconst x = 1;`}
            onChange={() => {}}
            height={h}
          />
        </div>
      ))}
    </div>
  ),
};

export const ReadOnly: Story = {
  args: {
    value: `// Generated handler output
const result = { status: "ok", count: 42 };`,
    onChange: () => {},
    readOnly: true,
    height: "100px",
  },
};

export const Interactive: Story = {
  args: {
    value: "",
    onChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState(
      `function greet(name) {\n  return "Hello, " + name;\n}`
    );
    return (
      <div className="space-y-3">
        <JsEditor
          value={value}
          onChange={setValue}
          height="250px"
        />
        <div className="rounded-md border bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Raw value:
          </p>
          <pre className="whitespace-pre-wrap font-mono text-xs">
            {value || "(empty)"}
          </pre>
        </div>
      </div>
    );
  },
};
