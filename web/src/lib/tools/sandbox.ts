/**
 * QuickJS WASM async sandbox for executing user-defined tool handlers in isolation.
 *
 * All user code runs inside a QuickJS VM (compiled to WASM), with no access
 * to Node.js APIs, filesystem, network, or process globals.
 *
 * ToolContext methods are injected as asyncified host callbacks, allowing
 * user code to `await context.wiki.get(...)` etc. while the host executes
 * the real DB query.
 */

import {
  newQuickJSAsyncWASMModuleFromVariant,
  type QuickJSAsyncWASMModule,
  type QuickJSAsyncContext,
  type QuickJSAsyncRuntime,
  type QuickJSHandle,
} from "quickjs-emscripten";
import RELEASE_ASYNC from "@jitl/quickjs-wasmfile-release-asyncify";
import {
  marshalToQJS,
  SandboxError,
  SandboxTimeoutError,
  SandboxMemoryError,
  type SandboxOptions,
} from "@/lib/functions/sandbox";
import type { ToolContext } from "./tool-context";

export {
  SandboxError,
  SandboxTimeoutError,
  SandboxMemoryError,
} from "@/lib/functions/sandbox";

// ── Configuration ──

const DEFAULT_OPTS: Required<SandboxOptions> = {
  memoryLimitBytes: 128 * 1024 * 1024,
  maxStackSizeBytes: 1024 * 1024,
  timeoutMs: 5000,
};

// ── WASM module singleton ──

let modulePromise: Promise<QuickJSAsyncWASMModule> | null = null;

function getAsyncModule(): Promise<QuickJSAsyncWASMModule> {
  if (!modulePromise) {
    modulePromise = newQuickJSAsyncWASMModuleFromVariant(RELEASE_ASYNC);
  }
  return modulePromise;
}

// ── Error classification ──

function classifySandboxError(raw: unknown): SandboxError {
  const msg =
    typeof raw === "object" && raw !== null
      ? ((raw as Record<string, unknown>).message as string) ?? String(raw)
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

// ── Promise resolution helper ──

/**
 * Extract the resolved value from a QJS handle that may be a Promise.
 * If the handle is a plain value, returns it directly.
 * If it's a Promise, runs executePendingJobs to resolve it synchronously.
 */
function resolveIfPromise(
  vm: QuickJSAsyncContext,
  runtime: QuickJSAsyncRuntime,
  handle: QuickJSHandle
): unknown {
  const typeStr = vm.typeof(handle);

  if (typeStr === "object") {
    const thenProp = vm.getProp(handle, "then");
    const isThen = vm.typeof(thenProp) === "function";
    thenProp.dispose();

    if (isThen) {
      let resolvedVal: unknown = undefined;
      let rejectedMsg: string | undefined = undefined;

      const onFulfilled = vm.newFunction("onFulfilled", (val) => {
        resolvedVal = vm.dump(val);
      });
      const onRejected = vm.newFunction("onRejected", (err) => {
        rejectedMsg = String(vm.dump(err));
      });

      const thenFn = vm.getProp(handle, "then");
      const thenResult = vm.callFunction(thenFn, handle, [
        onFulfilled,
        onRejected,
      ]);
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

      onFulfilled.dispose();
      onRejected.dispose();

      if (rejectedMsg !== undefined) {
        throw new SandboxError(`Async handler rejected: ${rejectedMsg}`);
      }

      return resolvedVal;
    }
  }

  return vm.dump(handle);
}

// ── Context injection helpers ──

/**
 * Register an asyncified host function on a QJS object.
 * When sandbox code calls `obj.methodName(...)`, the VM suspends,
 * the host runs the real async operation, then the VM resumes.
 */
function registerAsyncMethod(
  vm: QuickJSAsyncContext,
  obj: QuickJSHandle,
  name: string,
  hostFn: (...args: unknown[]) => Promise<unknown>
): void {
  const handle = vm.newAsyncifiedFunction(name, async function (...qjsArgs) {
    const jsArgs = qjsArgs.map((a) => vm.dump(a));
    const result = await hostFn(...jsArgs);
    return marshalToQJS(vm, result);
  });
  vm.setProp(obj, name, handle);
  handle.dispose();
}

/**
 * Inject the full ToolContext as `__context` global in the VM.
 * All methods are asyncified so user code can `await` them.
 */
function injectToolContext(
  vm: QuickJSAsyncContext,
  context: ToolContext
): void {
  const ctxObj = vm.newObject();

  // ── wiki ──
  const wikiObj = vm.newObject();
  registerAsyncMethod(vm, wikiObj, "get", (id) =>
    context.wiki.get(id as string)
  );
  registerAsyncMethod(vm, wikiObj, "findByPrefix", (prefix) =>
    context.wiki.findByPrefix(prefix as string)
  );
  registerAsyncMethod(vm, wikiObj, "search", (query) =>
    context.wiki.search(query as string)
  );
  vm.setProp(ctxObj, "wiki", wikiObj);
  wikiObj.dispose();

  // ── dataset ──
  const datasetObj = vm.newObject();
  registerAsyncMethod(vm, datasetObj, "get", (key) =>
    context.dataset.get(key as string)
  );
  registerAsyncMethod(vm, datasetObj, "getEntries", (key) =>
    context.dataset.getEntries(key as string)
  );
  vm.setProp(ctxObj, "dataset", datasetObj);
  datasetObj.dispose();

  // ── fn ──
  // context.fn(key) returns Promise<Function>. The returned function is
  // a host-compiled function. We wrap it as a sync QJS function.
  const fnHandle = vm.newAsyncifiedFunction(
    "fn",
    async function (...qjsArgs) {
      const key = vm.dump(qjsArgs[0]);
      const hostFn = await context.fn(key as string);
      // Wrap the host function as a sync QJS function
      const wrapped = vm.newFunction(`fn_${key}`, function (...callArgs) {
        const jsCallArgs = callArgs.map((a) => vm.dump(a));
        const result = hostFn(...jsCallArgs);
        return marshalToQJS(vm, result);
      });
      return wrapped;
    }
  );
  vm.setProp(ctxObj, "fn", fnHandle);
  fnHandle.dispose();

  // ── ontology ──
  const ontObj = vm.newObject();
  registerAsyncMethod(vm, ontObj, "types", () => context.ontology.types());
  registerAsyncMethod(vm, ontObj, "type", (key) =>
    context.ontology.type(key as string)
  );
  registerAsyncMethod(vm, ontObj, "query", (typeKey, filters) =>
    context.ontology.query(
      typeKey as string,
      filters as Record<string, unknown> | undefined
    )
  );
  registerAsyncMethod(vm, ontObj, "get", (typeKey, id) =>
    context.ontology.get(typeKey as string, id as string)
  );
  registerAsyncMethod(vm, ontObj, "create", (typeKey, data) =>
    context.ontology.create(
      typeKey as string,
      data as Record<string, unknown>
    )
  );
  registerAsyncMethod(vm, ontObj, "update", (typeKey, id, data) =>
    context.ontology.update(
      typeKey as string,
      id as string,
      data as Record<string, unknown>
    )
  );
  registerAsyncMethod(vm, ontObj, "delete", (typeKey, id) =>
    context.ontology.delete(typeKey as string, id as string)
  );
  registerAsyncMethod(
    vm,
    ontObj,
    "link",
    (sourceId, relationKey, targetId, metadata) =>
      context.ontology.link(
        sourceId as string,
        relationKey as string,
        targetId as string,
        metadata as Record<string, unknown> | undefined
      )
  );
  registerAsyncMethod(vm, ontObj, "unlink", (sourceId, relationKey, targetId) =>
    context.ontology.unlink(
      sourceId as string,
      relationKey as string,
      targetId as string
    )
  );
  registerAsyncMethod(vm, ontObj, "graph", (typeKey, id, options) =>
    context.ontology.graph(
      typeKey as string,
      id as string,
      options as { depth?: number } | undefined
    )
  );
  vm.setProp(ctxObj, "ontology", ontObj);
  ontObj.dispose();

  // Set as global
  vm.setProp(vm.global, "__context", ctxObj);
  ctxObj.dispose();
}

// ── Public API ──

/**
 * Execute a tool handler in an isolated QuickJS async sandbox.
 *
 * The handler code is a JS expression that evaluates to a function:
 *   `(args, context) => { ... }`
 *
 * Context methods (wiki, dataset, fn, ontology) are available as asyncified
 * host callbacks. The user code can `await` them normally.
 *
 * @param handlerCode - JS code string (arrow fn or function expression)
 * @param args - Input arguments to pass to the handler
 * @param context - ToolContext with wiki/dataset/fn/ontology methods
 * @param opts - Sandbox resource limits
 */
export async function executeToolInSandbox(
  handlerCode: string,
  args: unknown,
  context: ToolContext,
  opts?: SandboxOptions
): Promise<unknown> {
  const o = { ...DEFAULT_OPTS, ...opts };
  const mod = await getAsyncModule();
  const runtime: QuickJSAsyncRuntime = mod.newRuntime();
  runtime.setMemoryLimit(o.memoryLimitBytes);
  runtime.setMaxStackSize(o.maxStackSizeBytes);

  // Timeout via interrupt handler
  const deadline = Date.now() + o.timeoutMs;
  runtime.setInterruptHandler(() => Date.now() > deadline);

  const vm: QuickJSAsyncContext = runtime.newContext();

  try {
    // Inject context methods as asyncified host callbacks
    injectToolContext(vm, context);

    // Inject args as global
    const argsHandle = marshalToQJS(vm, args);
    vm.setProp(vm.global, "__args", argsHandle);
    argsHandle.dispose();

    // Evaluate the handler expression and call it.
    // Asyncified host functions appear synchronous from QJS's perspective,
    // so even `await context.wiki.get(...)` works transparently.
    // If the handler is `async`, the IIFE returns a Promise which we
    // resolve via executePendingJobs.
    const wrappedCode =
      `(function(){ var __fn = ${handlerCode}; return __fn(__args, __context); })()`;

    const evalResult = await vm.evalCodeAsync(wrappedCode);

    if (evalResult.error) {
      const errDump = vm.dump(evalResult.error);
      evalResult.error.dispose();
      throw classifySandboxError(errDump);
    }

    // The result may be a Promise (async handler). Resolve it.
    const result = resolveIfPromise(vm, runtime, evalResult.value);
    evalResult.value.dispose();
    return result;
  } finally {
    // Async WASM module disposal can throw when GC tries to free host
    // references after the runtime callback map is cleaned up. This is a
    // known issue with the asyncify variant — the error is non-critical
    // since the WASM memory is being freed regardless.
    try { vm.dispose(); } catch { /* ignore disposal errors */ }
    try { runtime.dispose(); } catch { /* ignore disposal errors */ }
  }
}
