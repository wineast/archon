export interface SchemaValidationError {
  path: string;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

/**
 * Validate data against a schema using the server-side validate endpoint.
 * Returns null if schemaId is not provided.
 */
export async function validateAgainstSchema(
  schemaId: string | null | undefined,
  data: unknown
): Promise<SchemaValidationResult | null> {
  if (!schemaId) return null;

  try {
    const res = await fetch(`/api/schemas/${schemaId}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: data }),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return { valid: result.valid, errors: result.errors ?? [] };
  } catch {
    return null;
  }
}
