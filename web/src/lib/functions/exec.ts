/**
 * Function exec — direct execution with static code scanning.
 *
 * User code is scanned for dangerous patterns (via acorn AST analysis),
 * then executed directly using `new Function()`. No WASM isolation.
 *
 * This approach is suitable for trusted FDE users who don't need
 * process-level isolation. The static scanner prevents accidental
 * use of Node.js APIs.
 */

import { scanCode } from "@/lib/code-scanner";
import { transformFunctionModule } from "@/lib/modules/transform-function-module";

// ── Error types ──

export class ExecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecError";
  }
}

export class CompilationError extends ExecError {
  constructor(message: string) {
    super(message);
    this.name = "CompilationError";
  }
}

// ── Public API: one-shot compile + execute ──

/**
 * Compile and execute a single user function (ES module format).
 *
 * @param code - ES module code with `export default function(input) { ... }`
 * @param input - Input to pass to the default export function
 * @param deps - Host dependencies to inject as named parameters (e.g. compileExpression)
 */
export async function compileAndExecFn(
  code: string,
  input: unknown,
  deps?: Record<string, unknown>,
): Promise<unknown> {
  // Static scan
  const scan = scanCode(code);
  if (!scan.ok) {
    throw new CompilationError(
      `Code scan failed:\n${scan.errors.join("\n")}`
    );
  }

  // Transform module format
  let transformed: ReturnType<typeof transformFunctionModule>;
  try {
    transformed = transformFunctionModule(code);
  } catch (e) {
    throw new CompilationError(
      e instanceof Error ? e.message : String(e)
    );
  }

  // Build the function with deps injected
  const depNames = Object.keys(deps ?? {});
  const depValues = Object.values(deps ?? {});

  // Build alias injections for archon:fn imports
  const aliasLines = Object.entries(transformed.aliases)
    .filter(([, key]) => depNames.includes(key))
    .map(([alias, key]) => `var ${alias} = __deps[${depNames.indexOf(key)}];`);

  // Wrap: inject deps as closure variables, run preamble, then define and call the function
  const wrappedCode = [
    // Inject deps
    ...depNames.map((name, i) => `var ${name} = __deps[${i}];`),
    // Inject import aliases
    ...aliasLines,
    // Preamble (top-level code like var declarations, helper functions)
    transformed.preamble,
    // Define and call the function
    `var __fn__ = ${transformed.fnExpression};`,
    `return __fn__(__input);`,
  ].join("\n");

  try {
    const fn = new Function("__deps", "__input", wrappedCode);
    const result = fn(depValues, input);
    // Await if result is a promise
    return result instanceof Promise ? await result : result;
  } catch (e) {
    if (e instanceof ExecError) throw e;
    throw new ExecError(
      e instanceof Error ? e.message : String(e)
    );
  }
}

// ── Public API: shared exec (Agent cache path) ──

export interface FunctionsExec {
  call(key: string, input: unknown): unknown;
  keys: string[];
  dispose(): void;
}

/**
 * Create an exec context with multiple pre-compiled ES module functions.
 * Functions are compiled in the provided order (caller should topo-sort).
 * Each function is available to later functions via the dependency injection system.
 *
 * Code format: `import dep from "archon:fn/dep"; export default function(input) { ... }`
 *
 * @param records - Functions in dependency order
 * @param deps - Host dependencies (e.g. compileExpression)
 */
export async function createFunctionsExec(
  records: Array<{ key: string; code: string }>,
  deps?: Record<string, unknown>,
): Promise<FunctionsExec> {
  const compiledFns = new Map<string, (input: unknown) => unknown>();
  const compiledKeys: string[] = [];

  for (const rec of records) {
    // Static scan
    const scan = scanCode(rec.code);
    if (!scan.ok) {
      throw new CompilationError(
        `Code scan failed for function "${rec.key}":\n${scan.errors.join("\n")}`
      );
    }

    // Transform module format
    let transformed: ReturnType<typeof transformFunctionModule>;
    try {
      transformed = transformFunctionModule(rec.code);
    } catch (e) {
      throw new CompilationError(
        `Failed to compile function "${rec.key}": ${e instanceof Error ? e.message : String(e)}`
      );
    }

    // Build dependency injection: both host deps and previously compiled functions
    const depNames: string[] = [];
    const depValues: unknown[] = [];

    // Add host deps
    if (deps) {
      for (const [name, value] of Object.entries(deps)) {
        depNames.push(name);
        depValues.push(value);
      }
    }

    // Add previously compiled functions (accessible by key).
    // If a compiled fn has the same key as a host dep, add it with a
    // prefixed name so it can be found by alias resolution below.
    for (const [key, fn] of compiledFns) {
      if (!depNames.includes(key)) {
        depNames.push(key);
        depValues.push(fn);
      } else {
        // Same key exists in host deps — add with prefix for alias resolution
        depNames.push(`__compiled_${key}`);
        depValues.push(fn);
      }
    }

    // Build import alias injections.
    // archon:fn/ imports should resolve to compiled functions, not host deps.
    const aliasLines = Object.entries(transformed.aliases)
      .map(([alias, key]) => {
        // Prefer compiled function (may be prefixed if name-clashed with host dep)
        const compiledIdx = depNames.indexOf(`__compiled_${key}`);
        if (compiledIdx >= 0) {
          return `var ${alias} = __deps[${compiledIdx}];`;
        }
        const idx = depNames.indexOf(key);
        if (idx >= 0) {
          return `var ${alias} = __deps[${idx}];`;
        }
        return null;
      })
      .filter((line): line is string => line !== null);

    const wrappedCode = [
      // Inject deps
      ...depNames.map((name, i) => `var ${name} = __deps[${i}];`),
      // Inject import aliases
      ...aliasLines,
      // Preamble (top-level code)
      transformed.preamble,
      // Define function and return it (not call it)
      `var __fn__ = ${transformed.fnExpression};`,
      `return __fn__;`,
    ].join("\n");

    try {
      const factory = new Function("__deps", wrappedCode);
      const fn = factory(depValues) as (input: unknown) => unknown;

      if (typeof fn !== "function") {
        throw new CompilationError(
          `Function "${rec.key}": module must have a default export that is a function`
        );
      }

      compiledFns.set(rec.key, fn);
      compiledKeys.push(rec.key);
    } catch (e) {
      if (e instanceof ExecError) throw e;
      throw new CompilationError(
        `Failed to compile function "${rec.key}": ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  let disposed = false;

  return {
    keys: compiledKeys,

    call(key: string, input: unknown): unknown {
      if (disposed) throw new ExecError("Exec context has been disposed");

      const fn = compiledFns.get(key);
      if (!fn) {
        throw new ExecError(`Function "${key}" not found in exec context`);
      }

      try {
        return fn(input);
      } catch (e) {
        if (e instanceof ExecError) throw e;
        throw new ExecError(
          e instanceof Error ? e.message : String(e)
        );
      }
    },

    dispose() {
      if (!disposed) {
        disposed = true;
        compiledFns.clear();
      }
    },
  };
}
