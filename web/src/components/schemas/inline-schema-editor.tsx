"use client";

import { useState } from "react";
import { JsonEditor } from "@/components/editors/json-editor";
import { SchemaParameterPreview } from "./schema-parameter-preview";
import type { JsonSchema7 } from "@/lib/schemas/types";

const DEFAULT_SCHEMA: JsonSchema7 = { type: "object", properties: {}, required: [] };

interface InlineSchemaEditorProps {
  value: JsonSchema7 | null;
  onChange: (v: JsonSchema7) => void;
  label: string;
}

export function InlineSchemaEditor({
  value,
  onChange,
  label,
}: InlineSchemaEditorProps) {
  const schema = value ?? DEFAULT_SCHEMA;

  const [customJson, setCustomJson] = useState<string>(() =>
    JSON.stringify(schema, null, 2)
  );

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">
        <JsonEditor
          value={customJson}
          onChange={(v) => {
            setCustomJson(v);
            try {
              const parsed = JSON.parse(v);
              onChange(parsed);
            } catch {
              // Invalid JSON, don't update form value
            }
          }}
          height="200px"
        />
      </div>
      <SchemaParameterPreview schema={schema} />
    </div>
  );
}
