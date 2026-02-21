import type { JsonSchema7 } from "@/lib/schemas/types";

export interface BuiltinTestCase {
  name: string;
  /** Description of what this example demonstrates */
  description?: string;
  /** The expression or input to pass to the builtin */
  input: unknown;
  /** The expected return value */
  expectedOutput: unknown;
}

export interface BuiltinFunction {
  /** Unique key matching the parameter name used in function fn(...) signatures */
  key: string;
  /** Display name */
  name: string;
  /** What this builtin function does */
  description: string;
  /** Where this comes from (e.g. npm package name) */
  source: string;
  /** Example / documentation code shown in the read-only detail view */
  code: string;
  /** Optional parameter definitions for the built-in function */
  parameters?: JsonSchema7;
  /** Optional return value definitions */
  returnParameters?: JsonSchema7;
  /** Built-in test cases to demonstrate usage */
  testCases?: BuiltinTestCase[];
}
