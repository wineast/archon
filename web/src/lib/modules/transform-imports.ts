/**
 * Transform `import` statements from `archon:*` modules into `__deps__` lookups.
 *
 * Used by the component system which runs in the browser via `new Function()`,
 * not in QuickJS. Since `new Function()` doesn't support ES module syntax,
 * we transform the imports into equivalent destructuring from a `__deps__` object.
 *
 * Supported import forms:
 * - `import X from "archon:xxx"`                 → `const X = __deps__["archon:xxx"].default`
 * - `import { A, B } from "archon:xxx"`           → `const { A, B } = __deps__["archon:xxx"]`
 * - `import { A as B } from "archon:xxx"`         → `const { A: B } = __deps__["archon:xxx"]`
 * - `import X, { A, B } from "archon:xxx"`        → both of the above
 *
 * Also transforms `export default function(...)` → strips `export default` and
 * captures the function for return.
 */

interface TransformResult {
  /** Transformed code with imports replaced by __deps__ lookups */
  code: string;
  /** Set of archon module specifiers referenced */
  modules: Set<string>;
}

/**
 * Transform archon:* import statements into __deps__ destructuring.
 *
 * @param source - Component source code with import/export statements
 * @returns Transformed code and set of referenced modules
 */
export function transformImports(source: string): TransformResult {
  const modules = new Set<string>();
  const lines: string[] = [];
  let hasExportDefault = false;

  for (const line of source.split("\n")) {
    const trimmed = line.trim();

    // Match: import ... from "archon:..."
    const importMatch = trimmed.match(
      /^import\s+(.+?)\s+from\s+["'](archon:[^"']+)["']\s*;?\s*$/
    );

    if (importMatch) {
      const [, specifiers, moduleSpec] = importMatch;
      modules.add(moduleSpec);

      // Parse the specifier(s)
      const parts = parseImportSpecifiers(specifiers);

      for (const part of parts) {
        if (part.type === "default") {
          lines.push(`const ${part.local} = __deps__["${moduleSpec}"].default;`);
        } else if (part.type === "named") {
          const bindings = part.names
            .map((n) => (n.imported !== n.local ? `${n.imported}: ${n.local}` : n.local))
            .join(", ");
          lines.push(`const { ${bindings} } = __deps__["${moduleSpec}"];`);
        }
      }
      continue;
    }

    // Match: export default function ...
    if (/^export\s+default\s+function\b/.test(trimmed)) {
      hasExportDefault = true;
      // Replace "export default function" with "var __default_export__ = function"
      lines.push(line.replace(/export\s+default\s+function/, "var __default_export__ = function"));
      continue;
    }

    // Match: export default (expression)
    if (/^export\s+default\s+/.test(trimmed)) {
      hasExportDefault = true;
      lines.push(line.replace(/export\s+default\s+/, "var __default_export__ = "));
      continue;
    }

    lines.push(line);
  }

  let code = lines.join("\n");
  if (hasExportDefault) {
    code += "\nreturn __default_export__;";
  }

  return { code, modules };
}

// ── Specifier parsing ──

interface DefaultSpec {
  type: "default";
  local: string;
}

interface NamedSpec {
  type: "named";
  names: Array<{ imported: string; local: string }>;
}

type ImportSpec = DefaultSpec | NamedSpec;

/**
 * Parse import specifiers like `X`, `{ A, B }`, `X, { A, B }`, `{ A as B }`.
 */
function parseImportSpecifiers(raw: string): ImportSpec[] {
  const result: ImportSpec[] = [];
  const s = raw.trim();

  // Check for named imports: { A, B, C as D }
  const namedMatch = s.match(/\{([^}]+)\}/);
  const namedPart = namedMatch ? namedMatch[1] : null;

  // Default import is everything before the `{` (or the whole string if no `{`)
  let defaultName: string | null = null;
  if (namedMatch) {
    const before = s.slice(0, namedMatch.index!).replace(/,\s*$/, "").trim();
    if (before) defaultName = before;
  } else {
    // No braces, entire string is the default import name
    defaultName = s;
  }

  if (defaultName) {
    result.push({ type: "default", local: defaultName });
  }

  if (namedPart) {
    const names = namedPart
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const parts = n.split(/\s+as\s+/);
        return {
          imported: parts[0].trim(),
          local: (parts[1] ?? parts[0]).trim(),
        };
      });
    result.push({ type: "named", names });
  }

  return result;
}
