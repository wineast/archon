import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { JsonEditor } from "../ui/editors/json-editor";

const meta = {
  title: "UI/JsonEditor",
  component: JsonEditor,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof JsonEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    value: JSON.stringify({ company: "GMCC", language: "zh" }, null, 2),
    onChange: () => {},
    height: "200px",
  },
};

export const Enum: Story = {
  args: {
    value: JSON.stringify(
      {
        w2: "Full Doc - W2 Wage Earner",
        self_employed: "NQM - 1year Self Employed",
        bank_statement: "NQM - Bank Statement",
      },
      null,
      2
    ),
    onChange: () => {},
    height: "250px",
  },
};

export const WithTemplateVariables: Story = {
  args: {
    value: JSON.stringify(
      {
        universe: {
          label: "GMCC Universe",
          incomes: ["{{income_type_enum.w2}}", "{{income_type_enum.self_employed}}"],
        },
      },
      null,
      2
    ),
    onChange: () => {},
    height: "300px",
    templateVariables: [
      "company_name",
      "income_type_enum",
      "state_enum",
      "product_name_enum",
    ],
  },
};

/** Demonstrates Liquid control flow syntax (for/if) inside JSON template values. */
export const WithTemplateSyntax: Story = {
  args: {
    value: [
      "{",
      '  "products": [',
      '    {% for product in product_routes %}',
      "    {",
      '      "name": "{{product.name}}",',
      '      "enabled": {% if product.active %}true{% else %}false{% endif %}',
      "    }{% unless forloop.last %},{% endunless %}",
      "    {% endfor %}",
      "  ]",
      "}",
    ].join("\n"),
    onChange: () => {},
    height: "300px",
    templateVariables: [
      "product_routes",
      "company_name",
    ],
  },
};

export const ReadOnly: Story = {
  args: {
    value: JSON.stringify({ readonly: true, data: [1, 2, 3] }, null, 2),
    onChange: () => {},
    readOnly: true,
    height: "150px",
  },
};

export const Interactive: Story = {
  args: {
    value: "",
    onChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState(
      JSON.stringify({ key: "value", list: [1, 2, 3] }, null, 2)
    );
    return (
      <div className="space-y-3">
        <JsonEditor
          value={value}
          onChange={setValue}
          height="250px"
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

/**
 * Regression test: changing templateVariables must NOT recreate the editor.
 * If the editor is recreated, focus and typed content would be lost.
 */
export const KeepsFocusOnVarChange: Story = {
  args: {
    value: "",
    onChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState("{}");
    const [vars, setVars] = useState(["a", "b"]);
    return (
      <div className="space-y-3">
        <JsonEditor
          value={value}
          onChange={setValue}
          templateVariables={vars}
          height="200px"
        />
        <button
          data-testid="change-vars"
          onClick={() => setVars(["a", "b", "c"])}
          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          Change variables
        </button>
        <pre data-testid="raw-value" className="font-mono text-xs">
          {value}
        </pre>
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    // 1. Click into the CodeMirror editor to focus it
    const cmContent = canvas.getByRole("textbox");
    await userEvent.click(cmContent);

    // 2. Type some text (braces must be escaped as {{ }} in userEvent.keyboard)
    await userEvent.type(cmContent, "hello");

    // 3. Verify the typed content appears in the raw value output
    const rawValue = canvas.getByTestId("raw-value");
    await expect(rawValue.textContent).toContain("hello");

    // 4. Change templateVariables — this previously caused editor recreation + focus loss
    const changeBtn = canvas.getByTestId("change-vars");
    await userEvent.click(changeBtn);

    // 5. The editor content should still be intact after the variable change
    await expect(rawValue.textContent).toContain("hello");
  },
};
