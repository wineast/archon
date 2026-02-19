import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ParameterList } from "../parameter-list";
import { ReturnParameterList } from "../return-parameter-list";
import type { EnumRefOption } from "../parameter-row";
import type { SchemaProperty } from "@/lib/schemas/types";

// ---------------------------------------------------------------------------
// Form values type (mirrors FunctionFormValues)
// ---------------------------------------------------------------------------

interface DemoFormValues {
  name: string;
  description: string;
  parameters: SchemaProperty[];
  returnParameters: SchemaProperty[];
}

// ---------------------------------------------------------------------------
// Live JSON preview — shows form state in real time
// ---------------------------------------------------------------------------

function FormJsonPreview() {
  const { control } = useFormContext<DemoFormValues>();
  const values = useWatch({ control });
  return (
    <pre className="mt-4 rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-[300px]">
      {JSON.stringify(values, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Integration demo component
// ---------------------------------------------------------------------------

function ParameterFormDemo({
  defaultValues,
  enumRefOptions,
  enumRefValues,
}: {
  defaultValues: DemoFormValues;
  enumRefOptions?: EnumRefOption[];
  enumRefValues?: Record<string, string[]>;
}) {
  const form = useForm<DemoFormValues>({ defaultValues });

  return (
    <FormProvider {...form}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Name
          </label>
          <Input
            className="mt-1 h-8 text-sm"
            {...form.register("name")}
            placeholder="Function name"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            className="mt-1 min-h-[60px] resize-none text-sm"
            {...form.register("description")}
            placeholder="What this function does..."
          />
        </div>

        <ParameterList
          fieldName="parameters"
          label="Parameters"
          enumRefOptions={enumRefOptions}
          enumRefValues={enumRefValues}
        />

        <ReturnParameterList
          fieldName="returnParameters"
          label="Return Parameters"
        />

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => alert(JSON.stringify(form.getValues(), null, 2))}>
            Get Values
          </Button>
          <Button size="sm" variant="outline" onClick={() => form.reset(defaultValues)}>
            Reset
          </Button>
        </div>

        <FormJsonPreview />
      </div>
    </FormProvider>
  );
}

// ---------------------------------------------------------------------------
// Meta (use a plain wrapper as the "component" for Storybook)
// ---------------------------------------------------------------------------

const meta = {
  title: "Parameters/Form Integration",
  component: ParameterFormDemo,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ParameterFormDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleParams: SchemaProperty[] = [
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
    type: "object",
    description: "Advanced options",
    required: false,
    defaultValue: { sort: "asc", page: 1 },
  },
];

const sampleReturnParams: SchemaProperty[] = [
  {
    id: "r1",
    name: "results",
    type: "object",
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

const enumRefOptions: EnumRefOption[] = [
  { id: "ds-us-states", key: "us_states", name: "US States", source: "dataset" },
  { id: "ds-product-categories", key: "product_categories", name: "Product Categories", source: "dataset" },
];

const enumRefValues: Record<string, string[]> = {
  "ds-us-states": ["CA", "NY", "TX", "FL", "WA"],
  "ds-product-categories": ["Electronics", "Clothing", "Food", "Books"],
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const EmptyForm: Story = {
  name: "Empty Form",
  args: {
    defaultValues: {
      name: "",
      description: "",
      parameters: [],
      returnParameters: [],
    },
  },
};

export const PrefilledForm: Story = {
  name: "Prefilled Form",
  args: {
    defaultValues: {
      name: "searchProducts",
      description: "Search for products by query with pagination support",
      parameters: sampleParams,
      returnParameters: sampleReturnParams,
    },
  },
};

export const WithEnumRef: Story = {
  name: "With Enum Ref (Dataset)",
  args: {
    defaultValues: {
      name: "getStateInfo",
      description: "Get information for a US state",
      parameters: [
        {
          id: "e1",
          name: "state",
          type: "enum",
          description: "US state code",
          required: true,
          enumRef: "us_states",
        },
        {
          id: "e2",
          name: "category",
          type: "enum",
          description: "Product category",
          required: false,
          enum: ["Electronics", "Clothing", "Food"],
        },
      ],
      returnParameters: [
        {
          id: "r1",
          name: "data",
          type: "object",
          description: "State information",
          required: true,
        },
      ],
    },
    enumRefOptions,
    enumRefValues,
  },
};
