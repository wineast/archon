import type { JsonSchema7 } from "@/lib/schemas/types";

export interface ComponentDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  toolInputSchema: JsonSchema7 | null;
  componentInputSchema: JsonSchema7 | null;
  componentSource: string;
}
