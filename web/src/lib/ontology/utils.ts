/**
 * Extract a display label from instance data using the type's titleProperty.
 */
export function extractLabel(
  data: Record<string, unknown>,
  titleProperty: string | null
): string {
  if (!titleProperty) return "";
  const val = data[titleProperty];
  return typeof val === "string" ? val : val != null ? String(val) : "";
}
