/**
 * Transform ES module-format tool handler code into IIFE-wrapped global code.
 *
 * QuickJS asyncified mode conflicts with ES module `import` statements
 * (the stack cannot be unwound twice). To work around this, we transform
 * module-format handler code at the host level before evaluation.
 *
 * Transforms:
 * - `import { wiki, dataset } from "archon:context"` → `var wiki = __context.wiki;`
 * - `import { compileExpression } from "archon:lib/filtrex"` → `var compileExpression = __libs.compileExpression;`
 * - `export default function(args) { ... }` → extracts function for IIFE wrapping
 * - `export default async function(args) { ... }` → same
 */

/**
 * Transform module-format tool handler into an IIFE-wrapped expression
 * that can be evaluated with `evalCodeAsync` in global scope.
 *
 * Returns code like: `(function(){ var wiki = __context.wiki; var compileExpression = __libs.compileExpression; ... var __fn = function(args) { ... }; return __fn(__args, __context); })()`
 */
export function transformToolHandlerImports(code: string): string {
  const preamble: string[] = [];
  const bodyLines: string[] = [];
  let handlerExpr: string | null = null;

  for (const line of code.split("\n")) {
    const trimmed = line.trim();

    // Match: import { ... } from "archon:context"
    const contextImport = trimmed.match(
      /^import\s+\{([^}]+)\}\s+from\s+["']archon:context["']\s*;?\s*$/
    );
    if (contextImport) {
      const names = contextImport[1].split(",").map((s) => s.trim()).filter(Boolean);
      for (const name of names) {
        preamble.push(`var ${name} = __context.${name};`);
      }
      continue;
    }

    // Match: import { ... } from "archon:lib/filtrex"
    const libImport = trimmed.match(
      /^import\s+\{([^}]+)\}\s+from\s+["']archon:lib\/filtrex["']\s*;?\s*$/
    );
    if (libImport) {
      const names = libImport[1].split(",").map((s) => s.trim()).filter(Boolean);
      for (const name of names) {
        preamble.push(`var ${name} = __libs.${name};`);
      }
      continue;
    }

    // Match: unsupported import (any import not from archon:context or archon:lib/filtrex)
    const unsupportedImport = trimmed.match(
      /^import\s+.+\s+from\s+["']([^"']+)["']\s*;?\s*$/
    );
    if (unsupportedImport) {
      const mod = unsupportedImport[1];
      throw new Error(
        `工具 Handler 不支持模块 "${mod}"，只能使用 import { ... } from "archon:context" 或 "archon:lib/filtrex"`
      );
    }

    // Match: export default function / export default async function
    const exportDefaultFn = trimmed.match(
      /^export\s+default\s+(async\s+)?function\s*/
    );
    if (exportDefaultFn) {
      // Replace "export default function" with just "function"
      const fnLine = line.replace(/export\s+default\s+/, "");
      bodyLines.push(fnLine);
      handlerExpr = "__handler__";
      continue;
    }

    // Match: export default (expression)
    const exportDefault = trimmed.match(/^export\s+default\s+/);
    if (exportDefault) {
      const expr = line.replace(/export\s+default\s+/, "").replace(/;?\s*$/, "");
      handlerExpr = expr;
      continue;
    }

    bodyLines.push(line);
  }

  // Build IIFE
  const parts = ["(function(){"];
  parts.push(...preamble);
  if (bodyLines.length > 0) {
    const body = bodyLines.join("\n");
    if (handlerExpr === "__handler__") {
      // The body contains the function definition, need to capture it
      parts.push(`var __handler__ = ${body}`);
    } else {
      parts.push(body);
    }
  }
  if (handlerExpr) {
    parts.push(`return (${handlerExpr})(__args, __context);`);
  }
  parts.push("})()");

  return parts.join("\n");
}
