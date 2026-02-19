export type SchemaPropertyType = "string" | "number" | "boolean" | "enum" | "object" | "array";

export interface SchemaProperty {
  id: string;
  name: string;
  type: SchemaPropertyType;
  description: string;
  required: boolean;
  defaultValue?: unknown;

  // enum
  enum?: string[];
  enumDatasetId?: string;

  // object（原 json）
  properties?: SchemaProperty[];
  schemaId?: string;

  // array
  items?: SchemaProperty;

  // string 约束
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "email" | "url" | "date" | "date-time" | "uuid";

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
