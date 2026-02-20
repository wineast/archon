import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { ToolDataCard } from "../tool-data-card";

const meta = {
  title: "Components/ToolDataCard",
  component: ToolDataCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ToolDataCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ---------- Basic ---------- */

export const Empty: Story = {
  args: {
    toolName: "",
    inputValue: "{}",
    outputValue: "{}",
    onToolNameChange: () => {},
    onInputChange: () => {},
    onOutputChange: () => {},
  },
};

export const WithData: Story = {
  args: {
    toolName: "get_weather",
    inputValue: JSON.stringify({ city: "Shanghai", unit: "celsius" }, null, 2),
    outputValue: JSON.stringify(
      { temperature: 22, condition: "sunny" },
      null,
      2
    ),
    onToolNameChange: () => {},
    onInputChange: () => {},
    onOutputChange: () => {},
  },
};

/* ---------- Slots ---------- */

export const WithHeaderExtra: Story = {
  args: {
    toolName: "search_products",
    inputValue: JSON.stringify({ query: "laptop" }, null, 2),
    outputValue: JSON.stringify({ results: [] }, null, 2),
    onToolNameChange: () => {},
    onInputChange: () => {},
    onOutputChange: () => {},
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

export const WithValidationErrors: Story = {
  args: {
    toolName: "create_order",
    inputValue: JSON.stringify({ amount: "not_a_number" }, null, 2),
    outputValue: JSON.stringify({ status: 123 }, null, 2),
    onToolNameChange: () => {},
    onInputChange: () => {},
    onOutputChange: () => {},
    inputExtra: (
      <div className="mt-1 space-y-0.5">
        <p className="text-xs text-destructive">
          amount: Expected number, received string
        </p>
      </div>
    ),
    outputExtra: (
      <div className="mt-1 space-y-0.5">
        <p className="text-xs text-destructive">
          status: Expected string, received number
        </p>
      </div>
    ),
  },
};

/* ---------- Custom Heights ---------- */

export const CompactHeight: Story = {
  args: {
    toolName: "ping",
    inputValue: "{}",
    outputValue: JSON.stringify({ ok: true }, null, 2),
    onToolNameChange: () => {},
    onInputChange: () => {},
    onOutputChange: () => {},
    inputHeight: "80px",
    outputHeight: "80px",
  },
};

/* ---------- Interactive ---------- */

export const Interactive: Story = {
  args: {
    toolName: "",
    inputValue: "{}",
    outputValue: "{}",
    onToolNameChange: () => {},
    onInputChange: () => {},
    onOutputChange: () => {},
  },
  render: () => {
    const [toolName, setToolName] = useState("get_weather");
    const [input, setInput] = useState(
      JSON.stringify({ city: "Beijing" }, null, 2)
    );
    const [output, setOutput] = useState(
      JSON.stringify({ temperature: 18 }, null, 2)
    );
    return (
      <ToolDataCard
        toolName={toolName}
        inputValue={input}
        outputValue={output}
        onToolNameChange={setToolName}
        onInputChange={setInput}
        onOutputChange={setOutput}
      />
    );
  },
};
