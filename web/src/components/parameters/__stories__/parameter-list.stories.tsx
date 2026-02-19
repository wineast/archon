import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormProvider, useForm } from "react-hook-form";
import { ParameterList } from "../parameter-list";
import type { EnumRefOption } from "../parameter-row";
import type { ToolParameter } from "@/lib/tools/types";

function FormWrapper({
  parameters = [],
  children,
}: {
  parameters?: ToolParameter[];
  children: React.ReactNode;
}) {
  const form = useForm({ defaultValues: { parameters } });
  return <FormProvider {...form}>{children}</FormProvider>;
}

const meta = {
  title: "Parameters/ParameterList",
  component: ParameterList,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ParameterList>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleParams: ToolParameter[] = [
  {
    id: "p1",
    name: "query",
    type: "string",
    description: "Search query string",
    required: true,
    defaultValue: "hello",
  },
  {
    id: "p2",
    name: "limit",
    type: "number",
    description: "Maximum number of results",
    required: false,
    defaultValue: 10,
  },
  {
    id: "p3",
    name: "verbose",
    type: "boolean",
    description: "Include detailed information",
    required: false,
    defaultValue: true,
  },
  {
    id: "p4",
    name: "format",
    type: "enum",
    description: "Output format",
    required: false,
    enum: ["json", "csv", "xml"],
    defaultValue: "json",
  },
  {
    id: "p5",
    name: "options",
    type: "json",
    description: "Advanced options",
    required: false,
    defaultValue: { sort: "asc", page: 1 },
  },
];

const enumRefOptions: EnumRefOption[] = [
  { id: "ds-us-states", key: "us_states", name: "US States", source: "dataset" },
  { id: "ds-product-categories", key: "product_categories", name: "Product Categories", source: "dataset" },
];

const enumRefValues: Record<string, string[]> = {
  "ds-us-states": ["CA", "NY", "TX", "FL", "WA"],
  "ds-product-categories": ["Electronics", "Clothing", "Food", "Books"],
};

export const Empty: Story = {
  args: { fieldName: "parameters", label: "Parameters" },
  render: (args) => (
    <FormWrapper>
      <ParameterList {...args} />
    </FormWrapper>
  ),
};

export const WithParameters: Story = {
  name: "With Parameters (all types)",
  args: { fieldName: "parameters", label: "Parameters" },
  render: (args) => (
    <FormWrapper parameters={sampleParams}>
      <ParameterList {...args} />
    </FormWrapper>
  ),
};

export const WithEnumRefOptions: Story = {
  name: "With Enum Ref Options",
  args: {
    fieldName: "parameters",
    label: "Parameters",
    enumRefOptions,
    enumRefValues,
  },
  render: (args) => {
    const params: ToolParameter[] = [
      {
        id: "e1",
        name: "state",
        type: "enum",
        description: "US state code",
        required: true,
        enumRef: "us_states",
      },
    ];
    return (
      <FormWrapper parameters={params}>
        <ParameterList {...args} />
      </FormWrapper>
    );
  },
};
