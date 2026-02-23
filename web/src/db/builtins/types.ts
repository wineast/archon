import type { JsonSchema7 } from "@/lib/schemas/types";

/** Metadata extracted from a code-defined build-chat tool. */
export interface BuiltinToolDef {
  key: string;
  name: string;
  description: string;
  parametersSchema: Record<string, unknown> | null;
}

/** Static definition of a builtin function. */
export interface BuiltinFunctionDef {
  key: string;
  name: string;
  description: string;
  code: string;
  parametersSchema: JsonSchema7;
  returnParametersSchema: JsonSchema7;
  testCases: {
    name: string;
    input: Record<string, unknown>;
    expectedOutput: unknown;
    showAsExample: boolean;
  }[];
}

/** Static definition of a builtin UI component. */
export interface BuiltinComponentDef {
  key: string;
  name: string;
  description: string;
  componentInputSchema?: JsonSchema7;
  /** Path to JSX source file (relative to component-sources/). Loaded at runtime. */
  sourceFile?: string;
  /** Populated at load time from sourceFile contents. */
  componentSource?: string;
}

/** Entry in the wiki manifest (content loaded from guide/ at runtime). */
export interface BuiltinWikiEntry {
  key: string;
  name: string;
  file: string;
}
