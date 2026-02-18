import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ComponentPreviewPanel } from "../component-preview-panel";

const meta = {
  title: "Tools/ComponentPreviewPanel",
  component: ComponentPreviewPanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComponentPreviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Sample JSX sources
// ---------------------------------------------------------------------------

const simpleBadgeSource = `<Badge variant="outline">Hello World</Badge>`;

const tableComponentSource = `function Component({ output }) {
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

const loadingComponentSource = `function Component({ isLoading, output }) {
  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{output.title}</div>
      <div className="text-xs text-muted-foreground">{output.description}</div>
    </div>
  );
}`;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Empty source returns null — the component is invisible.
 * Expand the panel manually by inspecting the DOM if needed.
 */
export const EmptySource: Story = {
  args: {
    componentSource: "",
    mockData: "{}",
    onMockDataChange: () => {},
  },
};

export const SimpleBadge: Story = {
  args: {
    componentSource: simpleBadgeSource,
    mockData: "{}",
    onMockDataChange: () => {},
  },
};

export const WithMockData: Story = {
  args: {
    componentSource: tableComponentSource,
    mockData: JSON.stringify(
      {
        items: [
          { name: "Rate", value: "6.5%" },
          { name: "Term", value: "30yr" },
          { name: "LTV", value: "80%" },
        ],
      },
      null,
      2
    ),
    onMockDataChange: () => {},
  },
};

export const LoadingState: Story = {
  name: "Loading State (isLoading)",
  args: {
    componentSource: loadingComponentSource,
    mockData: JSON.stringify(
      { title: "Results", description: "Fetched from API" },
      null,
      2
    ),
    onMockDataChange: () => {},
  },
};

export const Interactive: Story = {
  args: {
    componentSource: "",
    mockData: "{}",
    onMockDataChange: () => {},
  },
  render: () => {
    const [mockData, setMockData] = useState(
      JSON.stringify(
        {
          items: [
            { name: "Product A", value: "$100" },
            { name: "Product B", value: "$200" },
          ],
        },
        null,
        2
      )
    );

    return (
      <ComponentPreviewPanel
        componentSource={tableComponentSource}
        mockData={mockData}
        onMockDataChange={setMockData}
      />
    );
  },
};

export const InvalidJsx: Story = {
  name: "Invalid JSX (Error Boundary)",
  args: {
    componentSource: `<div>{this is not valid jsx</>`,
    mockData: "{}",
    onMockDataChange: () => {},
  },
};
