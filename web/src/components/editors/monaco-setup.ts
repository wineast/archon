import type * as monacoNs from "monaco-editor";
import { registerLanguages } from "./language";
import { registerThemes } from "./theme";

type Monaco = typeof monacoNs;

let initialized = false;

export function ensureMonacoSetup(monaco: Monaco): void {
  if (initialized) return;
  initialized = true;
  registerLanguages(monaco);
  registerThemes(monaco);

  // Disable all TypeScript/JavaScript diagnostics globally — our editors show
  // code snippets (JSX components, sandbox functions) without imports/type defs,
  // so all validation (errors, hints, "unnecessary" markers) is noise.
  // `languages.typescript` is deprecated in types; access via top-level namespace.
  const diagnosticsOff = {
    noSemanticValidation: true,
    noSuggestionDiagnostics: true,
    noSyntaxValidation: true,
  };
  const ts = (monaco as Record<string, unknown>).typescript as {
    typescriptDefaults?: { setDiagnosticsOptions: (opts: typeof diagnosticsOff) => void };
    javascriptDefaults?: { setDiagnosticsOptions: (opts: typeof diagnosticsOff) => void };
  } | undefined;
  ts?.typescriptDefaults?.setDiagnosticsOptions(diagnosticsOff);
  ts?.javascriptDefaults?.setDiagnosticsOptions(diagnosticsOff);
}
