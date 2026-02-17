/**
 * Parse a single (scalar) template var value according to its type.
 * DB value is always text; this function converts to the appropriate JS type.
 */
function parseSingleValue(value: string, type: string): unknown {
  switch (type) {
    case "number": {
      const n = parseFloat(value);
      return isNaN(n) ? value : n;
    }
    case "boolean":
      return value === "true";
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        console.warn(
          `[parseTemplateVarValue] Failed to parse JSON value: ${value}`
        );
        return value;
      }
    default:
      return value;
  }
}

/**
 * Parse a template var value according to its type and isArray flag.
 * DB value is always text; this function converts to the appropriate JS type.
 * On JSON.parse failure, falls back to the raw string with a warning.
 *
 * Legacy support: `type === "list"` is treated as `type: "text", isArray: true`.
 */
export function parseTemplateVarValue(
  value: string,
  type: string,
  isArray?: boolean
): unknown {
  // Legacy "list" type → text array
  if (type === "list") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : value;
    } catch {
      console.warn(
        `[parseTemplateVarValue] Failed to parse list value: ${value}`
      );
      return value;
    }
  }

  if (isArray) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        console.warn(
          `[parseTemplateVarValue] Expected array but got non-array: ${value}`
        );
        return value;
      }
      return parsed.map((item) =>
        type === "json" ? item : parseSingleValue(String(item), type)
      );
    } catch {
      console.warn(
        `[parseTemplateVarValue] Failed to parse array value: ${value}`
      );
      return value;
    }
  }

  return parseSingleValue(value, type);
}
