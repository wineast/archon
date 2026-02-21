import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MdEditor } from "../md-editor";

const meta = {
  title: "Editors/MdEditor",
  component: MdEditor,
  args: { height: "300px" },
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
  name: "默认示例",
  args: {
    value:
      "Hello {{borrower_name}},\n\nYour loan for {{property_address}} has been approved at {{interest_rate}}.\n\nBest regards,\n{{company_name}}",
    onChange: () => {},
    variables: ["borrower_name", "property_address", "interest_rate", "company_name"],
    placeholder: "Enter template text...",
  },
};

export const WithVariables: Story = {
  name: "带变量",
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
  name: "带文档引用",
  args: {
    value:
      "{% include 'Company Policies' %}\n\n---\n\nHello {{borrower_name}},\n\nPlease review the included document above.",
    onChange: () => {},
    variables: ["borrower_name", "company_name"],
    documents: [
      { key: "company_policies", title: "Company Policies" },
      { key: "employee_handbook", title: "Employee Handbook" },
      { key: "code_of_conduct", title: "Code of Conduct" },
    ],
    placeholder: "Enter template with document references...",
  },
};

export const Interactive: Story = {
  name: "交互演示",
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
          height="300px"
          variables={["company_name", "income_type_enum", "state_enum"]}
          documents={[{ key: "welcome_guide", title: "Welcome Guide" }]}
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
  name: "复杂模板",
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
      { key: "header_template", title: "Header Template" },
      { key: "footer_template", title: "Footer Template" },
      { key: "legal_disclaimer", title: "Legal Disclaimer" },
    ],
  },
};

export const Empty: Story = {
  name: "空内容",
  args: {
    value: "",
    onChange: () => {},
    placeholder: "Start typing your template here. Use {{ for datasets...",
  },
};
