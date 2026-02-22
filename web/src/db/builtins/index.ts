import path from "node:path";
import type { BuiltinFunctionDef, BuiltinComponentDef, BuiltinWikiEntry } from "./types";

export type { BuiltinToolDef, BuiltinFunctionDef, BuiltinComponentDef, BuiltinWikiEntry } from "./types";

/** Absolute path to the guide/ directory (wiki content source). */
export const GUIDE_DIR = path.resolve(process.cwd(), "guide");

/** Load builtin tool definitions (extracted from code-defined build-chat tools). */
export { loadBuiltinToolDefs } from "./tools";

/** Load builtin function definitions from static JSON. */
export function loadBuiltinFunctionDefs(): BuiltinFunctionDef[] {
  // Use require for JSON — avoids top-level await and works in both CJS/ESM
  return require("./functions.json") as BuiltinFunctionDef[];
}

/** Load builtin component definitions from static JSON. */
export function loadBuiltinComponentDefs(): BuiltinComponentDef[] {
  return require("./components.json") as BuiltinComponentDef[];
}

/** Load the wiki manifest (key → file mapping). Content is read from guide/ separately. */
export function loadBuiltinWikiManifest(): BuiltinWikiEntry[] {
  return require("./wiki.json") as BuiltinWikiEntry[];
}
