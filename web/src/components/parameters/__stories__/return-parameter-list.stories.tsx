import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormProvider, useForm } from "react-hook-form";
import { ReturnParameterList } from "../return-parameter-list";
import type { ToolParameter } from "@/lib/tools/types";

function FormWrapper({
  returnParameters = [],
  children,
}: {
  returnParameters?: ToolParameter[];
  children: React.ReactNode;
}) {
  const form = useForm({ defaultValues: { returnParameters } });
  return <FormProvider {...form}>{children}</FormProvider>;
}

const meta = {
  title: "Parameters/ReturnParameterList",
  component: ReturnParameterList,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReturnParameterList>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleReturnParams: ToolParameter[] = [
  {
    id: "r1",
    name: "results",
    type: "json",
    description: "Array of matching items",
    required: true,
  },
  {
    id: "r2",
    name: "total",
    type: "number",
    description: "Total count of matches",
    required: true,
  },
];

export const Empty: Story = {
  args: { fieldName: "returnParameters", label: "Return Parameters" },
  render: (args) => (
    <FormWrapper>
      <ReturnParameterList {...args} />
    </FormWrapper>
  ),
};

export const WithReturnParameters: Story = {
  name: "With Return Parameters",
  args: { fieldName: "returnParameters", label: "Return Parameters" },
  render: (args) => (
    <FormWrapper returnParameters={sampleReturnParams}>
      <ReturnParameterList {...args} />
    </FormWrapper>
  ),
};
