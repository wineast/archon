import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdEditor } from "../ui/editors/md-editor";

const meta = {
  title: "UI/MdEditor",
  component: MdEditor,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MdEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value:
      "Hello {{borrower_name}},\n\nYour loan for {{property_address}} has been approved at {{interest_rate}}.\n\nBest regards,\n{{company_name}}",
    onChange: () => {},
    variables: ["borrower_name", "property_address", "interest_rate", "company_name"],
    placeholder: "Enter template text...",
  },
};

export const WithVariables: Story = {
  args: {
    value: "公司名称: {{company_name}}\n回复语言: {{reply_language}}",
    onChange: () => {},
    variables: [
      "company_name",
      "reply_language",
      "income_type_enum",
      "state_enum",
      "product_name_enum",
    ],
    placeholder: "Type {{ to see dataset completions...",
  },
};

export const WithDocuments: Story = {
  args: {
    value:
      "{% include 'Company Policies' %}\n\n---\n\nHello {{borrower_name}},\n\nPlease review the included document above.",
    onChange: () => {},
    variables: ["borrower_name", "company_name"],
    documents: [
      { title: "Company Policies" },
      { title: "Employee Handbook" },
      { title: "Code of Conduct" },
    ],
    placeholder: "Enter template with document references...",
  },
};

export const Interactive: Story = {
  args: {
    value: "",
    onChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState(
      "公司: {{company_name}}\n收入类型: {{income_type_enum.w2}}"
    );
    return (
      <div className="space-y-3">
        <MdEditor
          value={value}
          onChange={setValue}
          variables={["company_name", "income_type_enum", "state_enum"]}
          documents={[{ title: "Welcome Guide" }]}
          placeholder="Try typing {{  to trigger autocomplete..."
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

export const ComplexTemplate: Story = {
  args: {
    value: `{% include 'Header Template' %}

Dear {{borrower_name}},

{% if is_approved %}
Congratulations! Your loan application has been approved.

Property: {{property_address}}
Loan Amount: {{loan_amount}}
Interest Rate: {{interest_rate}}

{% for doc in documents %}
- {{doc.title}}
{% endfor %}
{% else %}
We regret to inform you that your application requires further review.

{% unless has_appeal_rights %}
This decision is final.
{% endunless %}
{% endif %}

Best regards,
{{company_name}}
{{date}}`,
    onChange: () => {},
    variables: [
      "borrower_name",
      "is_approved",
      "property_address",
      "loan_amount",
      "interest_rate",
      "has_appeal_rights",
      "company_name",
    ],
    documents: [
      { title: "Header Template" },
      { title: "Footer Template" },
      { title: "Legal Disclaimer" },
    ],
  },
};

export const Empty: Story = {
  args: {
    value: "",
    onChange: () => {},
    placeholder: "Start typing your template here. Use {{ for datasets...",
  },
};
