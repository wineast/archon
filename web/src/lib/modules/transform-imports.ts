/**
 * Transform `import` statements into `__deps__` lookups for `new Function()` execution.
 *
 * Since `new Function()` doesn't support ES module syntax, all import statements
 * must be transformed or stripped before execution.
 *
 * Supported import forms:
 * - `import X from "archon:xxx"`                 → `const X = __deps__["archon:xxx"].default`
 * - `import { A, B } from "archon:xxx"`           → `const { A, B } = __deps__["archon:xxx"]`
 * - `import { A as B } from "archon:xxx"`         → `const { A: B } = __deps__["archon:xxx"]`
 * - `import X, { A, B } from "archon:xxx"`        → both of the above
 *
 * Bare module specifiers (e.g. `"react"`, `"lucide-react"`) are automatically
 * remapped to their `archon:*` equivalents. Unknown modules are stripped.
 *
 * Also transforms `export default function(...)` → strips `export default` and
 * captures the function for return.
 */

/** Mapping of bare module specifiers to their archon:* equivalents. */
const BARE_MODULE_ALIASES: Record<string, string> = {
  react: "archon:react",
  "lucide-react": "archon:icons",
};

interface TransformResult {
  /** Transformed code with imports replaced by __deps__ lookups */
  code: string;
  /** Set of archon module specifiers referenced */
  modules: Set<string>;
}

/**
 * Transform import statements into __deps__ destructuring.
 *
 * @param source - Component source code with import/export statements
 * @returns Transformed code and set of referenced modules
 */
export function transformImports(source: string): TransformResult {
  const modules = new Set<string>();
  const lines: string[] = [];
  let hasExportDefault = false;

  // Pre-process: join multiline import statements into single lines.
  // e.g. `import {\n  A,\n  B,\n} from "mod"` → `import { A, B, } from "mod"`
  const normalized = joinMultilineImports(source);

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();

    // Strip: import type ... (TypeScript type-only imports)
    if (/^import\s+type\s+/.test(trimmed)) {
      continue;
    }

    // Strip: side-effect-only imports (import "something")
    if (/^import\s+["'][^"']+["']\s*;?\s*$/.test(trimmed)) {
      continue;
    }

    // Match: import ... from "..."
    const importMatch = trimmed.match(
      /^import\s+(.+?)\s+from\s+["']([^"']+)["']\s*;?\s*$/
    );

    if (importMatch) {
      const [, specifiers, rawModuleSpec] = importMatch;

      // Resolve module specifier: archon:* pass through, bare names get remapped
      const moduleSpec = rawModuleSpec.startsWith("archon:")
        ? rawModuleSpec
        : BARE_MODULE_ALIASES[rawModuleSpec];

      if (!moduleSpec) {
        // Unknown module — strip (can't resolve in new Function)
        continue;
      }

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

// ── Multiline import joining ──

/**
 * Join multiline import statements into single lines so the line-by-line
 * transformer can process them.
 *
 * Detects lines starting with `import` that contain an unmatched `{` (no closing `}`
 * before `from`), and concatenates subsequent lines until the `from "..."` is found.
 */
function joinMultilineImports(source: string): string {
  const rawLines = source.split("\n");
  const result: string[] = [];
  let buffer: string | null = null;

  for (const line of rawLines) {
    if (buffer !== null) {
      // Accumulating a multiline import
      buffer += " " + line.trim();
      // Check if this line completes the import (contains `from "..."` or `from '...'`)
      if (/from\s+["'][^"']+["']/.test(buffer)) {
        result.push(buffer);
        buffer = null;
      }
      continue;
    }

    const trimmed = line.trim();
    // Detect start of a multiline import: starts with `import` but has no `from "..."` on same line
    // Note: import type is NOT excluded here — multiline `import type { ... } from "mod"`
    // must be joined first, then stripped by the main loop's single-line import type check.
    if (
      /^import\s+/.test(trimmed) &&
      !(/from\s+["']/.test(trimmed)) &&
      !(/^import\s+["']/.test(trimmed))
    ) {
      buffer = trimmed;
      continue;
    }

    result.push(line);
  }

  // If buffer is still open (malformed import), flush it as-is
  if (buffer !== null) {
    result.push(buffer);
  }

  return result.join("\n");
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
