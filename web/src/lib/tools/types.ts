export type ToolParamType = "string" | "number" | "boolean" | "enum";

export interface ToolParameter {
  id: string;
  name: string;
  type: ToolParamType;
  description: string;
  required: boolean;
  enum?: string[];
  enumRef?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  output: string;
  handler: string;
  enabled: boolean;
}

/** Slim payload sent to the API (no id/enabled). */
export interface ToolDefinitionPayload {
  name: string;
  description: string;
  parameters: ToolParameter[];
  output: string;
  handler: string;
}
