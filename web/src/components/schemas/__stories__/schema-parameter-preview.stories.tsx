import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SchemaParameterPreview } from "../schema-parameter-preview";
import type { JsonSchema7 } from "@/lib/schemas/types";

const meta = {
  title: "Schemas/SchemaParameterPreview",
  component: SchemaParameterPreview,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SchemaParameterPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Schemas ───

const flatSchema: JsonSchema7 = {
  type: "object",
  required: ["ltv", "loanAmount"],
  properties: {
    ltv: {
      type: "number",
      description: "Loan-to-Value ratio (percentage, max 70%)",
    },
    loanAmount: {
      type: "number",
      description: "Loan amount in dollars (max $4.5MM)",
    },
    isNoFico: {
      type: "boolean",
      description: "Whether borrower has no FICO/No Credit History",
    },
    notes: {
      type: "string",
      description: "Additional notes",
    },
  },
};

const enumSchema: JsonSchema7 = {
  type: "object",
  required: ["occupancy", "propertyType"],
  properties: {
    occupancy: {
      type: "string",
      enum: ["Primary", "Investment", "Second Home"],
      description: "Property occupancy type",
    },
    propertyType: {
      type: "string",
      enum: ["SFR", "Condo", "2-4 Unit", "Townhouse", "PUD"],
    },
    loanPurpose: {
      type: "string",
      enum: ["Purchase", "Rate/Term Refinance", "Cash-Out Refinance"],
      description: "Loan purpose",
    },
    status: {
      type: "string",
      enum: ["active", "inactive"],
      description: "Account status",
    },
  },
};

const nestedSchema: JsonSchema7 = {
  type: "object",
  required: ["borrower"],
  properties: {
    loanAmount: {
      type: "number",
      description: "Loan amount in dollars",
    },
    borrower: {
      type: "object",
      description: "Borrower information",
      required: ["name", "ficoScore"],
      properties: {
        name: { type: "string", description: "Full name" },
        ficoScore: { type: "number", description: "FICO score (680+)" },
        employment: {
          type: "object",
          description: "Employment details",
          properties: {
            employer: { type: "string", description: "Employer name" },
            yearsEmployed: { type: "number", description: "Years at current job" },
            incomeType: {
              type: "string",
              enum: ["W2", "Self-Employed", "1099"],
            },
          },
        },
      },
    },
    property: {
      type: "object",
      description: "Property details",
      required: ["type"],
      properties: {
        type: {
          type: "string",
          enum: ["SFR", "Condo", "2-4 Unit"],
        },
        address: { type: "string", description: "Property address" },
        units: { type: "number", description: "Number of units (1-4)" },
      },
    },
  },
};

const emptySchema: JsonSchema7 = {
  type: "object",
  properties: {},
};

const mixedSchema: JsonSchema7 = {
  type: "object",
  required: ["query"],
  properties: {
    query: { type: "string", description: "Search query" },
    filters: {
      type: "object",
      description: "Search filters",
      properties: {
        category: {
          type: "string",
          enum: ["news", "blog", "docs", "forum"],
        },
        dateRange: {
          type: "object",
          properties: {
            from: { type: "string", description: "Start date (ISO)" },
            to: { type: "string", description: "End date (ISO)" },
          },
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
      },
    },
    limit: { type: "number", description: "Max results (default: 20)" },
  },
};

const longContentSchema: JsonSchema7 = {
  type: "object",
  required: ["state"],
  properties: {
    state: {
      type: "string",
      enum: [
        "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
        "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
        "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
        "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
        "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
        "New Hampshire", "New Jersey", "New Mexico", "New York",
      ],
      description: "US state where the property is located. Must match the state on the appraisal report and title commitment.",
    },
    documentationType: {
      type: "string",
      enum: ["Full Doc", "Bank Statement (12mo)", "Bank Statement (24mo)", "Asset Qualifier", "DSCR", "P&L Only", "1099 Only", "WVOE", "No Doc"],
      description: "Income documentation type required for underwriting. Determines which income calculation worksheet to use and affects pricing adjustments.",
    },
    longDescription: {
      type: "string",
      description: "This is an extremely long description field that contains a lot of detailed information about the parameter including its purpose, validation rules, edge cases, default behavior, and relationship to other fields in the schema. It should wrap naturally without being truncated.",
    },
  },
};

// ─── Stories ───

export const Flat: Story = {
  name: "扁平参数",
  args: { schema: flatSchema },
};

export const WithEnum: Story = {
  name: "枚举值",
  args: { schema: enumSchema },
};

export const Nested: Story = {
  name: "嵌套对象",
  args: { schema: nestedSchema },
};

export const Mixed: Story = {
  name: "综合示例",
  args: { schema: mixedSchema },
};

export const LongContent: Story = {
  name: "长内容换行",
  args: { schema: longContentSchema },
};

export const Empty: Story = {
  name: "空 Schema",
  args: { schema: emptySchema },
};
