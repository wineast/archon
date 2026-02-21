import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { DataCard } from "../data-card";

const meta = {
  title: "Components/DataCard",
  component: DataCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ---------- Basic ---------- */

export const Empty: Story = {
  args: {
    dataValue: "{}",
    onDataChange: () => {},
  },
};

export const WithData: Story = {
  args: {
    dataValue: JSON.stringify(
      { name: "get_weather", input: { city: "Shanghai" }, output: { temperature: 22 } },
      null,
      2
    ),
    onDataChange: () => {},
  },
};

/* ---------- Slots ---------- */

export const WithHeaderExtra: Story = {
  args: {
    dataValue: JSON.stringify(
      { name: "search_products", input: { query: "laptop" }, output: { results: [] } },
      null,
      2
    ),
    onDataChange: () => {},
    headerExtra: (
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1.5 text-xs text-muted-foreground"
      >
        Load
      </Button>
    ),
  },
};

export const WithDataExtra: Story = {
  args: {
    dataValue: JSON.stringify({ amount: "not_a_number" }, null, 2),
    onDataChange: () => {},
    dataExtra: (
      <div className="mt-1 space-y-0.5">
        <p className="text-xs text-destructive">
          amount: Expected number, received string
        </p>
      </div>
    ),
  },
};

/* ---------- Custom Heights ---------- */

export const CompactHeight: Story = {
  args: {
    dataValue: JSON.stringify({ ok: true }, null, 2),
    onDataChange: () => {},
    height: "80px",
  },
};

/* ---------- Interactive ---------- */

export const Interactive: Story = {
  args: {
    dataValue: "{}",
    onDataChange: () => {},
  },
  render: () => {
    const [data, setData] = useState(
      JSON.stringify(
        { name: "get_weather", input: { city: "Beijing" }, output: { temperature: 18 } },
        null,
        2
      )
    );
    return (
      <DataCard
        dataValue={data}
        onDataChange={setData}
      />
    );
  },
};
