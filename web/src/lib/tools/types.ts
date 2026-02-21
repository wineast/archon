import type { JsonSchema7 } from "@/lib/schemas/types";

export interface ToolDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  parametersSchemaId?: string | null;
  returnParametersSchemaId?: string | null;
  handler: string | null;
  url: string | null;
  componentId: string | null;
  enabled: boolean;
  executionTarget: "server" | "client" | "host";
  sandboxMode: "light" | "full";
}

/** Slim payload sent to the API (no id/enabled). */
export interface ToolDefinitionPayload {
  name: string;
  description: string;
  parameters: JsonSchema7;
  returnParameters?: JsonSchema7;
  handler?: string | null;
  url?: string | null;
  executionTarget?: "server" | "client" | "host";
  sandboxMode?: "light" | "full";
}
