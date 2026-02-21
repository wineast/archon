/**
 * JSON Schema 7 type definition with x- extensions for Archon-specific metadata.
 *
 * This is the canonical schema representation stored in the database and used throughout the app.
 * Custom metadata uses `x-` prefixed keys per JSON Schema convention.
 */
export interface JsonSchema7 {
  // Core
  type?: string | string[];
  description?: string;
  default?: unknown;
  const?: unknown;
  enum?: unknown[];

  // Object
  properties?: Record<string, JsonSchema7>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema7;

  // Array
  items?: JsonSchema7 | JsonSchema7[];
  prefixItems?: JsonSchema7[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  // Number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Composition
  oneOf?: JsonSchema7[];
  anyOf?: JsonSchema7[];
  allOf?: JsonSchema7[];

  // Ref
  $ref?: string;
  $defs?: Record<string, JsonSchema7>;

  // Archon x- extensions
  "x-discriminator"?: string;
  "x-discriminatorValues"?: string[];
  "x-unionMode"?: "oneOf" | "anyOf";
}

/**
 * Display type used in the UI type selector.
 * Maps to JSON Schema constructs but provides a friendlier UX.
 */
export type DisplayType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "union"
  | "null"
  | "const";

/** Empty object schema — convenience constant. */
export const EMPTY_OBJECT_SCHEMA: JsonSchema7 = {
  type: "object",
  properties: {},
  required: [],
};

// ─── Legacy types (kept for migration only) ───

/** @deprecated Use DisplayType instead */
export type SchemaPropertyType = "string" | "number" | "boolean" | "enum" | "object" | "array" | "union" | "null" | "const";

/** @deprecated Use JsonSchema7 instead — kept only for migration from old format */
export interface SchemaProperty {
  id: string;
  name: string;
  type: SchemaPropertyType;
  description: string;
  required: boolean;
  defaultValue?: unknown;
  nullable?: boolean;

  // enum
  enum?: string[];
  enumDatasetId?: string;

  // object
  properties?: SchemaProperty[];
  schemaId?: string;
  schemaIds?: string[];
  additionalProperties?: SchemaProperty;

  // const
  constValue?: unknown;

  // union
  discriminator?: string;
  discriminatorValues?: string[];
  variants?: SchemaProperty[];
  unionMode?: "oneOf" | "anyOf";

  // array
  items?: SchemaProperty;
  tuple?: boolean;
  prefixItems?: SchemaProperty[];

  // string constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "email" | "url" | "date" | "date-time" | "uuid" | "time" | "ipv4" | "ipv6";

  // number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  integer?: boolean;

  // array constraints
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}
