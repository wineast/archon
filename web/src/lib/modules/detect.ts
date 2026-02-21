/**
 * Detect whether code uses ES module format (import/export statements).
 *
 * Used by all three execution engines (functions, tool handlers, components)
 * to decide between the legacy closure-injection path and the new module path.
 */

/**
 * Returns true if `code` contains top-level `import` or `export` statements.
 *
 * Matches lines starting with (optional whitespace then):
 * - `import ... from "..."`
 * - `import "..."`
 * - `export default ...`
 * - `export function ...`
 * - `export { ... }`
 *
 * Does NOT match `import()` dynamic expressions or commented-out imports.
 */
export function isModuleFormat(code: string): boolean {
  // Strip single-line comments to avoid false positives
  const stripped = code.replace(/\/\/.*$/gm, "");
  // Match import declarations or export declarations at line start
  return /^\s*(import\s+|export\s+)/m.test(stripped);
}

/**
 * Extract function keys from `import ... from "archon:fn/<key>"` statements.
 */
export function inferDepsFromImports(
  code: string,
  knownKeys: Set<string>,
): string[] {
  const deps: string[] = [];
  const re = /import\s+.+?\s+from\s+["']archon:fn\/([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const key = m[1];
    if (knownKeys.has(key)) {
      deps.push(key);
    }
  }
  return deps;
}

/**
 * Extract component keys from `import ... from "archon:component/<key>"` statements.
 */
export function inferComponentDepsFromImports(
  code: string,
  knownKeys: Set<string>,
): string[] {
  const deps: string[] = [];
  const re = /import\s+.+?\s+from\s+["']archon:component\/([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const key = m[1];
    if (knownKeys.has(key)) {
      deps.push(key);
    }
  }
  return deps;
}
