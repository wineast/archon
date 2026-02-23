/**
 * Static code scanner using acorn AST analysis.
 *
 * Detects dangerous patterns in user code before execution:
 * - Forbidden global identifiers (process, global, globalThis, etc.)
 * - Forbidden calls (require, eval, new Function, setTimeout/setInterval with strings)
 * - Non-archon imports
 * - Prototype chain escapes (constructor.constructor)
 */

import * as acorn from "acorn";
import * as walk from "acorn-walk";

const FORBIDDEN_GLOBALS = new Set([
  "process",
  "global",
  "globalThis",
  "__dirname",
  "__filename",
  "Buffer",
]);

export interface ScanResult {
  ok: boolean;
  errors: string[];
}

/**
 * Scan user code for dangerous patterns.
 * Returns `{ ok: true }` if no issues found, otherwise `{ ok: false, errors }`.
 */
export function scanCode(code: string): ScanResult {
  const errors: string[] = [];

  let ast: acorn.Node;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
    });
  } catch {
    // If acorn can't parse it, let it fail at execution time
    return { ok: true, errors: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walk.simple(ast, {
    // Check identifiers for forbidden globals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Identifier(node: any) {
      if (FORBIDDEN_GLOBALS.has(node.name)) {
        errors.push(
          `禁止使用 Node.js 全局变量 "${node.name}"（第 ${node.loc?.start?.line ?? "?"}行）`
        );
      }
    },

    // Check for require(...) and eval(...) calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CallExpression(node: any) {
      const callee = node.callee;

      // require(...)
      if (callee.type === "Identifier" && callee.name === "require") {
        errors.push(
          `禁止使用 require()（第 ${callee.loc?.start?.line ?? "?"}行）`
        );
      }

      // eval(...)
      if (callee.type === "Identifier" && callee.name === "eval") {
        errors.push(
          `禁止使用 eval()（第 ${callee.loc?.start?.line ?? "?"}行）`
        );
      }

      // setTimeout/setInterval with string argument
      if (
        callee.type === "Identifier" &&
        (callee.name === "setTimeout" || callee.name === "setInterval") &&
        node.arguments.length > 0 &&
        node.arguments[0].type === "Literal" &&
        typeof node.arguments[0].value === "string"
      ) {
        errors.push(
          `禁止使用 ${callee.name}() 传入字符串参数（第 ${callee.loc?.start?.line ?? "?"}行）`
        );
      }
    },

    // Check for new Function(...)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NewExpression(node: any) {
      if (node.callee.type === "Identifier" && node.callee.name === "Function") {
        errors.push(
          `禁止使用 new Function()（第 ${node.callee.loc?.start?.line ?? "?"}行）`
        );
      }
    },

    // Check for non-archon imports
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ImportDeclaration(node: any) {
      const source = node.source.value as string;
      if (!source.startsWith("archon:")) {
        errors.push(
          `禁止导入非 archon 模块 "${source}"（第 ${node.loc?.start?.line ?? "?"}行）。只能使用 import ... from "archon:*"`
        );
      }
    },

    // Check for constructor.constructor escape
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MemberExpression(node: any) {
      // Detect pattern: X.constructor.constructor
      if (
        node.property?.type === "Identifier" &&
        node.property.name === "constructor" &&
        node.object?.type === "MemberExpression" &&
        node.object.property?.type === "Identifier" &&
        node.object.property.name === "constructor"
      ) {
        errors.push(
          `禁止使用 constructor.constructor 原型链逃逸（第 ${node.loc?.start?.line ?? "?"}行）`
        );
      }
    },
  });

  // Deduplicate errors (same global may appear multiple times)
  const unique = [...new Set(errors)];
  return { ok: unique.length === 0, errors: unique };
}
