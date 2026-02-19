import type { SchemaProperty, SchemaPropertyType } from "@/lib/schemas/types";

/** @deprecated Use SchemaProperty from "@/lib/schemas/types" */
export type ToolParameter = SchemaProperty;
/** @deprecated Use SchemaPropertyType from "@/lib/schemas/types" */
export type ToolParamType = SchemaPropertyType;

// Also re-export new names for consumers still importing from here
export type { SchemaProperty, SchemaPropertyType } from "@/lib/schemas/types";

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
  parameters: SchemaProperty[];
  returnParameters?: SchemaProperty[];
  handler: string;
  executionTarget?: "server" | "client" | "host";
  sandboxMode?: "light" | "full";
}
