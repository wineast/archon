import type { JsonSchema7 } from "@/lib/schemas/types";

export interface SchemaValidationError {
  path: string;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

/**
 * Validate data against an inline JSON Schema using the server-side validate endpoint.
 * Returns null if schema is not provided.
 */
export async function validateAgainstSchema(
  schema: JsonSchema7 | null | undefined,
  data: unknown
): Promise<SchemaValidationResult | null> {
  if (!schema) return null;

  try {
    const res = await fetch("/api/schemas/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schema, input: data }),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return { valid: result.valid, errors: result.errors ?? [] };
  } catch {
    return null;
  }
}
