import type { Liquid } from "liquidjs";

/**
 * Register built-in custom filters (json, keys, values) on a Liquid engine.
 * Shared between simpleLiquid (dataset rendering) and processTemplate (full rendering).
 */
export function registerBuiltinFilters(engine: Liquid): void {
  engine.registerFilter("json", (value: unknown) => JSON.stringify(value));

  engine.registerFilter("keys", (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.keys(value)
      : value
  );

  engine.registerFilter("values", (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? Object.values(value)
      : value
  );
}
