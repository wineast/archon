/**
 * Transform ES module-format function code into executable form.
 *
 * Parses:
 * - `import X from "archon:fn/Y"` → dep map { X: "Y" }
 * - `export default function(input) { ... }` → function expression
 *
 * Returns the dependency keys, local aliases, preamble code, and the extracted
 * function expression that can be wrapped in `new Function()` for direct execution.
 */

export interface TransformResult {
  /** Dependency function keys (from archon:fn/<key>) */
  depKeys: string[];
  /** Mapping from local alias to dep key: { localName: "depKey" } */
  aliases: Record<string, string>;
  /** Top-level code before the export (e.g. var declarations, helper functions) */
  preamble: string;
  /** The extracted function expression string */
  fnExpression: string;
}

/**
 * Transform a function module's ES module code into a directly-executable form.
 *
 * @param code - ES module code with optional `import X from "archon:fn/Y"` and `export default function(input) { ... }`
 * @returns Parsed result with dep keys, aliases, preamble, and function expression
 */
export function transformFunctionModule(code: string): TransformResult {
  const depKeys: string[] = [];
  const aliases: Record<string, string> = {};
  const preambleLines: string[] = [];
  const fnLines: string[] = [];
  let fnExpression: string | null = null;
  let collectingFn = false;

  for (const line of code.split("\n")) {
    const trimmed = line.trim();

    // Match: import X from "archon:fn/Y"
    const fnImport = trimmed.match(
      /^import\s+(\w+)\s+from\s+["']archon:fn\/([^"']+)["']\s*;?\s*$/
    );
    if (fnImport) {
      const [, localName, key] = fnImport;
      depKeys.push(key);
      aliases[localName] = key;
      continue;
    }

    // Match: unsupported import (any import not from archon:fn/*)
    const unsupportedImport = trimmed.match(
      /^import\s+.+\s+from\s+["']([^"']+)["']\s*;?\s*$/
    );
    if (unsupportedImport) {
      const mod = unsupportedImport[1];
      throw new Error(
        `函数不支持模块 "${mod}"，只能使用 import X from "archon:fn/<key>"`
      );
    }

    // Match: export default function / export default async function
    const exportDefaultFn = trimmed.match(
      /^export\s+default\s+(async\s+)?function\s*/
    );
    if (exportDefaultFn) {
      // Remove "export default" prefix
      const fnLine = line.replace(/export\s+default\s+/, "");
      fnLines.push(fnLine);
      collectingFn = true;
      fnExpression = "__fn__";
      continue;
    }

    // Match: export default (expression, e.g. arrow function)
    const exportDefault = trimmed.match(/^export\s+default\s+/);
    if (exportDefault) {
      const expr = line.replace(/export\s+default\s+/, "").replace(/;?\s*$/, "");
      fnExpression = expr;
      continue;
    }

    if (collectingFn) {
      fnLines.push(line);
    } else {
      preambleLines.push(line);
    }
  }

  if (!fnExpression) {
    throw new Error("函数模块必须包含 export default function(input) { ... }");
  }

  const preamble = preambleLines.join("\n");

  let finalFnExpression: string;
  if (fnExpression === "__fn__") {
    // The fnLines contain the function definition (without "export default")
    finalFnExpression = fnLines.join("\n");
  } else {
    finalFnExpression = fnExpression;
  }

  return { depKeys, aliases, preamble, fnExpression: finalFnExpression };
}
