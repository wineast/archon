/**
 * QuickJS WASM sandbox for executing user-defined functions in isolation.
 *
 * All user code runs inside a QuickJS VM (compiled to WASM), with no access
 * to Node.js APIs, filesystem, network, or process globals.
 */

import {
  getQuickJS,
  shouldInterruptAfterDeadline,
  type QuickJSWASMModule,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
} from "quickjs-emscripten";

// ── Error types ──

export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}

export class SandboxCompilationError extends SandboxError {
  constructor(message: string) {
    super(message);
    this.name = "SandboxCompilationError";
  }
}

export class SandboxTimeoutError extends SandboxError {
  constructor(message: string) {
    super(message);
    this.name = "SandboxTimeoutError";
  }
}

export class SandboxMemoryError extends SandboxError {
  constructor(message: string) {
    super(message);
    this.name = "SandboxMemoryError";
  }
}

// ── Configuration ──

export interface SandboxOptions {
  memoryLimitBytes?: number; // default 128MB
  maxStackSizeBytes?: number; // default 1MB
  timeoutMs?: number; // default 5000ms
}

const DEFAULT_OPTS: Required<SandboxOptions> = {
  memoryLimitBytes: 128 * 1024 * 1024,
  maxStackSizeBytes: 1024 * 1024,
  timeoutMs: 5000,
};

// ── WASM module singleton ──

let modulePromise: Promise<QuickJSWASMModule> | null = null;

export function getModule(): Promise<QuickJSWASMModule> {
  if (!modulePromise) {
    modulePromise = getQuickJS();
  }
  return modulePromise;
}

// ── Value marshaling: JS → QuickJS ──

export function marshalToQJS(
  vm: QuickJSContext,
  value: unknown
): QuickJSHandle {
  if (value === null || value === undefined) {
    return vm.undefined;
  }

  switch (typeof value) {
    case "number":
      return vm.newNumber(value);
    case "string":
      return vm.newString(value);
    case "boolean":
      return value ? vm.true : vm.false;
    case "function": {
      return vm.newFunction(value.name || "hostFn", function (...args) {
        // Unmarshal args from QJS → JS
        const jsArgs = args.map((a) => vm.dump(a));
        // Call host function
        const result = (value as Function)(...jsArgs);
        // Marshal result back to QJS
        return marshalToQJS(vm, result);
      });
    }
    case "object": {
      if (Array.isArray(value)) {
        const arr = vm.newArray();
        for (let i = 0; i < value.length; i++) {
          const elem = marshalToQJS(vm, value[i]);
          vm.setProp(arr, i, elem);
          elem.dispose();
        }
        return arr;
      }
      // Plain object
      const obj = vm.newObject();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const val = marshalToQJS(vm, v);
        vm.setProp(obj, k, val);
        val.dispose();
      }
      return obj;
    }
    default:
      return vm.undefined;
  }
}

// ── Helpers ──

function createRuntime(
  mod: QuickJSWASMModule,
  opts: Required<SandboxOptions>
): QuickJSRuntime {
  const runtime = mod.newRuntime();
  runtime.setMemoryLimit(opts.memoryLimitBytes);
  runtime.setMaxStackSize(opts.maxStackSizeBytes);
  runtime.setInterruptHandler(
    shouldInterruptAfterDeadline(Date.now() + opts.timeoutMs)
  );
  return runtime;
}

/** Classify QJS error into typed SandboxError subclasses. */
function classifySandboxError(raw: unknown): SandboxError {
  const msg = typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>).message as string ?? String(raw)
    : String(raw);

  if (/interrupted/i.test(msg)) {
    return new SandboxTimeoutError(`Execution timed out: ${msg}`);
  }
  if (/memory/i.test(msg) || /allocation/i.test(msg)) {
    return new SandboxMemoryError(`Memory limit exceeded: ${msg}`);
  }
  if (/stack overflow/i.test(msg)) {
    return new SandboxMemoryError(`Stack overflow: ${msg}`);
  }
  return new SandboxError(msg);
}

/**
 * Extract the resolved value from a QJS handle that may be a Promise.
 * If the handle is a plain value, returns it directly.
 * If it's a Promise, runs executePendingJobs to resolve it synchronously.
 */
function resolveIfPromise(
  vm: QuickJSContext,
  runtime: QuickJSRuntime,
  handle: QuickJSHandle
): unknown {
  const typeStr = vm.typeof(handle);

  // Check if it's a thenable / Promise
  if (typeStr === "object") {
    const thenProp = vm.getProp(handle, "then");
    const isThen = vm.typeof(thenProp) === "function";
    thenProp.dispose();

    if (isThen) {
      // It's a Promise — set up .then() to capture the resolved value
      let resolvedVal: unknown = undefined;
      let rejectedMsg: string | undefined = undefined;

      const onFulfilled = vm.newFunction("onFulfilled", (val) => {
        resolvedVal = vm.dump(val);
      });
      const onRejected = vm.newFunction("onRejected", (err) => {
        rejectedMsg = String(vm.dump(err));
      });

      const thenFn = vm.getProp(handle, "then");
      const thenResult = vm.callFunction(thenFn, handle, [onFulfilled, onRejected]);
      if (thenResult.error) {
        const errDump = vm.dump(thenResult.error);
        thenResult.error.dispose();
        thenFn.dispose();
        onFulfilled.dispose();
        onRejected.dispose();
        throw classifySandboxError(errDump);
      }
      thenResult.value.dispose();
      thenFn.dispose();

      // Drive microtask queue
      const jobResult = runtime.executePendingJobs();
      if (jobResult.error) {
        const errDump = vm.dump(jobResult.error);
        jobResult.error.dispose();
        onFulfilled.dispose();
        onRejected.dispose();
        throw classifySandboxError(errDump);
      }
      jobResult.value; // number of executed jobs

      onFulfilled.dispose();
      onRejected.dispose();

      if (rejectedMsg !== undefined) {
        throw new SandboxError(`Async function rejected: ${rejectedMsg}`);
      }

      return resolvedVal;
    }
  }

  // Plain value
  return vm.dump(handle);
}

// ── Public API: one-shot compile + execute ──

/**
 * Compile and execute a single user function in an isolated sandbox.
 * Creates a fresh Runtime + Context, executes, then disposes.
 *
 * @param code - User code containing `function fn(...) { ... }`
 * @param input - Input to pass to the compiled function
 * @param deps - Host dependencies to inject as globals (e.g. compileExpression)
 * @param opts - Sandbox resource limits
 */
export async function compileAndExecFn(
  code: string,
  input: unknown,
  deps?: Record<string, unknown>,
  opts?: SandboxOptions
): Promise<unknown> {
  const o = { ...DEFAULT_OPTS, ...opts };
  const mod = await getModule();
  const runtime = createRuntime(mod, o);
  const vm = runtime.newContext();

  try {
    // Inject dependencies as globals
    if (deps) {
      for (const [name, value] of Object.entries(deps)) {
        const handle = marshalToQJS(vm, value);
        vm.setProp(vm.global, name, handle);
        handle.dispose();
      }
    }

    // Build dep names list for the factory call
    const depNames = deps ? Object.keys(deps) : [];

    // Compile: evaluate user code + call fn() factory with deps object
    const depsObj = depNames.length > 0 ? `{ ${depNames.join(", ")} }` : "";
    const evalCode = `${code}\nif (typeof fn !== 'function') throw new Error('code must define function fn()');\nfn(${depsObj});`;
    const compileResult = vm.evalCode(evalCode);
    if (compileResult.error) {
      const errDump = vm.dump(compileResult.error);
      compileResult.error.dispose();
      throw new SandboxCompilationError(
        typeof errDump === "object" && errDump?.message
          ? errDump.message
          : String(errDump)
      );
    }

    const handler = compileResult.value;
    if (vm.typeof(handler) !== "function") {
      handler.dispose();
      throw new SandboxCompilationError(
        "fn() must return a function"
      );
    }

    // Marshal input and call
    const inputHandle = marshalToQJS(vm, input);
    const callResult = vm.callFunction(handler, vm.undefined, [inputHandle]);
    inputHandle.dispose();
    handler.dispose();

    if (callResult.error) {
      const errDump = vm.dump(callResult.error);
      callResult.error.dispose();
      throw classifySandboxError(errDump);
    }

    const result = resolveIfPromise(vm, runtime, callResult.value);
    callResult.value.dispose();
    return result;
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}

// ── Public API: shared sandbox (Agent cache path) ──

export interface FunctionsSandbox {
  call(key: string, input: unknown): unknown;
  keys: string[];
  dispose(): void;
}

/**
 * Create a long-lived sandbox with multiple pre-compiled functions.
 * Functions are compiled in the provided order (caller should topo-sort).
 * Each function result is stored as `globalThis.<key>` so later functions can reference it.
 *
 * @param records - Functions in dependency order
 * @param deps - Host dependencies (e.g. compileExpression)
 * @param opts - Sandbox resource limits
 */
export async function createFunctionsSandbox(
  records: Array<{ key: string; code: string; depNames: string[] }>,
  deps?: Record<string, unknown>,
  opts?: SandboxOptions
): Promise<FunctionsSandbox> {
  const o = { ...DEFAULT_OPTS, ...opts };
  const mod = await getModule();
  const runtime = createRuntime(mod, o);
  const vm = runtime.newContext();

  // Inject base deps as globals
  if (deps) {
    for (const [name, value] of Object.entries(deps)) {
      const handle = marshalToQJS(vm, value);
      vm.setProp(vm.global, name, handle);
      handle.dispose();
    }
  }

  const compiledKeys: string[] = [];

  // Compile each function in order
  for (const rec of records) {
    const depsObj = rec.depNames.length > 0 ? `{ ${rec.depNames.join(", ")} }` : "";
    const evalCode = `${rec.code}\nif (typeof fn !== 'function') throw new Error('code must define function fn()');\nfn(${depsObj});`;
    const result = vm.evalCode(evalCode);
    if (result.error) {
      const errDump = vm.dump(result.error);
      result.error.dispose();
      vm.dispose();
      runtime.dispose();
      throw new SandboxCompilationError(
        `Failed to compile function "${rec.key}": ${typeof errDump === "object" && errDump?.message ? errDump.message : String(errDump)}`
      );
    }

    // Store as globalThis.__fn_<key> (the callable) and globalThis.<key> (for cross-ref)
    vm.setProp(vm.global, `__fn_${rec.key}`, result.value);
    vm.setProp(vm.global, rec.key, result.value);
    result.value.dispose();
    compiledKeys.push(rec.key);
  }

  let disposed = false;

  return {
    keys: compiledKeys,

    call(key: string, input: unknown): unknown {
      if (disposed) throw new SandboxError("Sandbox has been disposed");

      // Reset interrupt handler deadline for each call
      runtime.setInterruptHandler(
        shouldInterruptAfterDeadline(Date.now() + o.timeoutMs)
      );

      const fnHandle = vm.getProp(vm.global, `__fn_${key}`);
      if (vm.typeof(fnHandle) !== "function") {
        fnHandle.dispose();
        throw new SandboxError(`Function "${key}" not found in sandbox`);
      }

      const inputHandle = marshalToQJS(vm, input);
      const callResult = vm.callFunction(fnHandle, vm.undefined, [inputHandle]);
      inputHandle.dispose();
      fnHandle.dispose();

      if (callResult.error) {
        const errDump = vm.dump(callResult.error);
        callResult.error.dispose();
        throw classifySandboxError(errDump);
      }

      const result = resolveIfPromise(vm, runtime, callResult.value);
      callResult.value.dispose();
      return result;
    },

    dispose() {
      if (!disposed) {
        disposed = true;
        vm.dispose();
        runtime.dispose();
      }
    },
  };
}
