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
  enumRef?: string;
  /** Nested fields when type === "json". */
  properties?: ToolParameter[];
}

export interface ToolDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  returnParameters: ToolParameter[];
  parametersSchemaRef?: string | null;
  returnParametersSchemaRef?: string | null;
  output: string;
  handler: string;
  component: string;
  componentSource: string;
  componentMockData: string;
  enabled: boolean;
  executionTarget: "server" | "client";
}

/** Slim payload sent to the API (no id/enabled). */
export interface ToolDefinitionPayload {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returnParameters?: ToolParameter[];
  handler: string;
  executionTarget?: "server" | "client";
}
