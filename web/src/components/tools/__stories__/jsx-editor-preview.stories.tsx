import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { JsEditor } from "@/components/ui/editors/js-editor";
import { ComponentPreviewPanel } from "../component-preview-panel";

// ---------------------------------------------------------------------------
// Combined demo component (mirrors tool-form's JSX section)
// ---------------------------------------------------------------------------

interface JsxEditorPreviewProps {
  initialSource?: string;
  initialMockData?: string;
}

function JsxEditorPreview({
  initialSource = "",
  initialMockData = "{}",
}: JsxEditorPreviewProps) {
  const [source, setSource] = useState(initialSource);
  const [mockData, setMockData] = useState(initialMockData);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        UI Component (JSX)
      </label>

      {/* Tab switcher */}
      <div className="flex items-center rounded-md border border-border p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("editor")}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            activeTab === "editor"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            activeTab === "preview"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Preview
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "editor" ? (
        <JsEditor
          value={source}
          onChange={setSource}
          height="300px"
        />
      ) : (
        <ComponentPreviewPanel
          componentSource={source}
          mockData={mockData}
          onMockDataChange={setMockData}
        />
      )}

      {/* Debug info */}
      <div className="rounded-md border bg-muted/50 p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          Source length: {source.length} chars
        </p>
        <pre className="max-h-[150px] overflow-auto whitespace-pre-wrap font-mono text-xs">
          {source || "(empty)"}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Tools/JSX Editor + Preview",
  component: JsxEditorPreview,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JsxEditorPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Sample sources
// ---------------------------------------------------------------------------

const badgeSource = `<Badge variant="outline">Hello from JSX</Badge>`;

const tableSource = `function Component({ output }) {
  if (!output?.items?.length) {
    return <div className="text-sm text-muted-foreground">No data</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {output.items.map((item, i) => (
          <TableRow key={i}>
            <TableCell>{item.name}</TableCell>
            <TableCell>{item.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}`;

const richSource = `function Component({ output, isLoading }) {
  if (isLoading) return <Spinner />;

  const items = output?.results ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge>{output.status}</Badge>
        <span className="text-sm text-muted-foreground">
          {items.length} results
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Term</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{r.product}</TableCell>
              <TableCell>{r.rate}</TableCell>
              <TableCell>{r.term}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}`;

const richMockData = JSON.stringify(
  {
    status: "success",
    results: [
      { product: "30yr Fixed", rate: "6.5%", term: "360 months" },
      { product: "15yr Fixed", rate: "5.8%", term: "180 months" },
      { product: "5/1 ARM", rate: "6.0%", term: "360 months" },
    ],
  },
  null,
  2
);

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Empty: Story = {
  args: {
    initialSource: "",
    initialMockData: "{}",
  },
};

export const SimpleBadge: Story = {
  args: {
    initialSource: badgeSource,
    initialMockData: "{}",
  },
};

export const TableWithData: Story = {
  args: {
    initialSource: tableSource,
    initialMockData: JSON.stringify(
      {
        items: [
          { name: "Rate", value: "6.5%" },
          { name: "Term", value: "30yr" },
        ],
      },
      null,
      2
    ),
  },
};

export const RichComponent: Story = {
  name: "Rich Component (Edit → Preview)",
  args: {
    initialSource: richSource,
    initialMockData: richMockData,
  },
};
