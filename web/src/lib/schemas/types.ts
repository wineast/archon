export type SchemaPropertyType = "string" | "number" | "boolean" | "enum" | "object" | "array" | "union" | "null" | "const";

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

  // object（原 json）
  properties?: SchemaProperty[];
  schemaId?: string;
  schemaIds?: string[];
  /** Map/Record: value type for dynamic keys (additionalProperties in JSON Schema). */
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

  // string 约束
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "email" | "url" | "date" | "date-time" | "uuid" | "time" | "ipv4" | "ipv6";

  // number 约束
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  integer?: boolean;

  // array 约束
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}
