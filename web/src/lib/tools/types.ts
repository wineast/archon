export type ToolParamType = "string" | "number" | "boolean" | "enum" | "json";

export interface ToolParameter {
  id: string;
  name: string;
  type: ToolParamType;
  description: string;
  required: boolean;
  /** Whether this field is an array of the given type. */
  isArray?: boolean;
  /** Default value for this parameter. */
  defaultValue?: unknown;
  enum?: string[];
  /** Dataset UUID for enum resolution. Mutually exclusive with enum[]. */
  enumDatasetId?: string;
  /** Nested fields when type === "json". */
  properties?: ToolParameter[];
  /** Schema UUID for json type. Mutually exclusive with manual properties. */
  schemaId?: string;
}

export interface ToolDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  parametersSchemaId?: string | null;
  returnParametersSchemaId?: string | null;
  output: string;
  handler: string;
  componentId: string | null;
  enabled: boolean;
  executionTarget: "server" | "client" | "host";
  sandboxMode: "light" | "full";
}

/** Slim payload sent to the API (no id/enabled). */
export interface ToolDefinitionPayload {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returnParameters?: ToolParameter[];
  handler: string;
  executionTarget?: "server" | "client" | "host";
  sandboxMode?: "light" | "full";
}
