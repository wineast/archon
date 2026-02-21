import type * as monacoNs from "monaco-editor";
import { registerLanguages } from "./language";
import { registerThemes } from "./theme";
import { STATIC_ARCHON_DECLARATIONS } from "@/lib/modules/archon-types";

type Monaco = typeof monacoNs;

let initialized = false;

// Track dynamic declarations added via addExtraLib so we can dispose + replace
const dynamicLibDisposables: monacoNs.IDisposable[] = [];

interface TSDefaults {
  setDiagnosticsOptions: (opts: Record<string, boolean>) => void;
  setCompilerOptions: (opts: Record<string, unknown>) => void;
  addExtraLib: (content: string, filePath?: string) => monacoNs.IDisposable;
}

/** Access `monaco.languages.typescript.typescriptDefaults` via untyped path. */
function getTSDefaults(monaco: Monaco): TSDefaults | undefined {
  const ts = (monaco as Record<string, unknown>).languages as Record<string, unknown> | undefined;
  const typescript = ts?.typescript as { typescriptDefaults?: TSDefaults } | undefined;
  return typescript?.typescriptDefaults;
}

export function ensureMonacoSetup(monaco: Monaco): void {
  if (initialized) return;
  initialized = true;
  registerLanguages(monaco);
  registerThemes(monaco);

  const tsDefaults = getTSDefaults(monaco);
  if (tsDefaults) {
    // Enable diagnostics now that we have proper type declarations
    tsDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSuggestionDiagnostics: false,
      noSyntaxValidation: false,
    });

    // Configure compiler for JSX + ES modules
    tsDefaults.setCompilerOptions({
      target: 99, // ESNext
      module: 99, // ESNext
      moduleResolution: 2, // Node
      jsx: 2, // React
      jsxFactory: "React.createElement",
      allowJs: true,
      strict: false,
      noEmit: true,
      esModuleInterop: true,
      allowNonTsExtensions: true,
    });

    // Register static archon:* type declarations
    tsDefaults.addExtraLib(STATIC_ARCHON_DECLARATIONS, "archon-static.d.ts");
  }

  // Also handle JS defaults for .js files
  const jsTs = (monaco as Record<string, unknown>).languages as Record<string, unknown> | undefined;
  const jsTypescript = jsTs?.typescript as {
    javascriptDefaults?: { setDiagnosticsOptions: (opts: Record<string, boolean>) => void };
  } | undefined;
  jsTypescript?.javascriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSuggestionDiagnostics: true,
    noSyntaxValidation: true,
  });
}

/**
 * Add dynamic type declarations (per-agent function/component types).
 * Replaces any previously added dynamic declarations.
 */
export function setDynamicDeclarations(monaco: Monaco, declarations: string): void {
  const tsDefaults = getTSDefaults(monaco);
  if (!tsDefaults) return;

  // Dispose previous dynamic libs
  for (const d of dynamicLibDisposables) d.dispose();
  dynamicLibDisposables.length = 0;

  if (declarations) {
    dynamicLibDisposables.push(
      tsDefaults.addExtraLib(declarations, "archon-dynamic.d.ts")
    );
  }
}
