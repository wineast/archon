import type { BuiltinFunction } from "./types";
import compileExpression from "./compile-expression";

export type { BuiltinFunction, BuiltinTestCase } from "./types";

/** All built-in functions available to dynamic functions as dependencies */
export const BUILTIN_FUNCTIONS: BuiltinFunction[] = [compileExpression];
