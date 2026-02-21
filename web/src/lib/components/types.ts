import type { JsonSchema7 } from "@/lib/schemas/types";

export interface ComponentDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  scenario: "tool" | "component";
  inputSchema: JsonSchema7 | null;
  outputSchema: JsonSchema7 | null;
  componentSource: string;
}
