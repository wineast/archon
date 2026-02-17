import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TemplateEditor } from "../ui/template-editor";

const meta = {
  title: "UI/TemplateEditor",
  component: TemplateEditor,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TemplateEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value:
      "Hello {{borrowerName}},\n\nYour loan for {{propertyAddress}} has been approved at {{interestRate}}.\n\nBest regards,\n{{agentName}}",
    onChange: () => {},
    variables: ["borrowerName", "propertyAddress", "interestRate", "agentName"],
    placeholder: "Enter template text...",
  },
};

export const WithVariables: Story = {
  args: {
    value: "Dear {{name}}, welcome to {{company}}!",
    onChange: () => {},
    variables: [
      "name",
      "company",
      "email",
      "role",
      "startDate",
      "managerName",
    ],
    placeholder: "Type {{ to see variable completions...",
  },
};

export const WithDocuments: Story = {
  args: {
    value:
      "{% include 'Company Policies' %}\n\n---\n\nHello {{employeeName}},\n\nPlease review the included document above.",
    onChange: () => {},
    variables: ["employeeName", "department"],
    documents: [
      { title: "Company Policies" },
      { title: "Employee Handbook" },
      { title: "Code of Conduct" },
    ],
    placeholder: "Enter template with document references...",
  },
};

export const WithLookups: Story = {
  args: {
    value:
      "Available states: {{lookup.property_state_label}}\n\nData: {{lookup.property_state_json}}",
    onChange: () => {},
    variables: ["borrowerName"],
    lookups: [
      { key: "property_state", name: "Property State" },
      { key: "loan_type", name: "Loan Type" },
      { key: "document_type", name: "Document Type" },
    ],
    documents: [{ title: "Guidelines" }],
    placeholder: "Type {{ to see variable, lookup and document completions...",
  },
};

export const Interactive: Story = {
  args: {
    value: "",
    onChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState(
      "Hi {{name}}, welcome to {{company}}!"
    );
    return (
      <div className="space-y-3">
        <TemplateEditor
          value={value}
          onChange={setValue}
          variables={["name", "company", "email"]}
          documents={[{ title: "Welcome Guide" }]}
          lookups={[{ key: "department", name: "Department" }]}
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

Dear {{borrowerName}},

{% if isApproved %}
Congratulations! Your loan application has been approved.

Property: {{propertyAddress}}
Loan Amount: {{loanAmount}}
Interest Rate: {{interestRate}}

{% for doc in documents %}
- {{doc.title}}
{% endfor %}
{% else %}
We regret to inform you that your application requires further review.

{% unless hasAppealRights %}
This decision is final.
{% endunless %}
{% endif %}

Best regards,
{{agentName}}
{{currentDate}}`,
    onChange: () => {},
    variables: [
      "borrowerName",
      "isApproved",
      "propertyAddress",
      "loanAmount",
      "interestRate",
      "documents",
      "hasAppealRights",
      "agentName",
      "currentDate",
    ],
    documents: [
      { title: "Header Template" },
      { title: "Footer Template" },
      { title: "Legal Disclaimer" },
    ],
    lookups: [
      { key: "property_state", name: "Property State" },
      { key: "loan_type", name: "Loan Type" },
    ],
  },
};

export const Empty: Story = {
  args: {
    value: "",
    onChange: () => {},
    placeholder: "Start typing your template here. Use {{ for variables...",
  },
};
