"use client";

import * as React from "react";
import Editor, { DiffEditor as MonacoDiffEditor, type OnMount, type DiffOnMount } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "./use-dark-mode";
import { ARCHON_LIGHT, ARCHON_DARK } from "./theme";
import { ensureMonacoSetup } from "./monaco-setup";
import {
  type CompletionConfig,
  type CompletionDocument,
  type CompletionTool,
  type CompletionOntologyType,
  registerEditorConfig,
  ensureCompletionProvider,
} from "./completions";

const SHARED_OPTIONS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  lineNumbersMinChars: 3,
  overviewRulerLanes: 0,
  fixedOverflowWidgets: true,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
} as const;

interface MdEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  /** Pass variable name→data map to enable {{key.field}} nested completions */
  variableMap?: Record<string, unknown>;
  documents?: CompletionDocument[];
  tools?: CompletionTool[];
  ontologyTypes?: CompletionOntologyType[];
  placeholder?: string;
  className?: string;
  height?: string;
  /** Pass original text to enable diff mode */
  original?: string;
  readOnly?: boolean;
}

function MdEditor({
  value,
  onChange,
  variables = [],
  variableMap,
  documents = [],
  tools = [],
  ontologyTypes,
  placeholder = "",
  className,
  height,
  original,
  readOnly = false,
}: MdEditorProps) {
  const isDark = useDarkMode();
  const theme = isDark ? ARCHON_DARK : ARCHON_LIGHT;
  const [isEmpty, setIsEmpty] = React.useState(!value);
  const isDiff = original !== undefined;

  const configRef = React.useRef<CompletionConfig | null>(null);
  const unregisterRef = React.useRef<(() => void) | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Keep configRef up to date
  React.useEffect(() => {
    configRef.current = { variables, variableMap, documents, tools, ontologyTypes };
  }, [variables, variableMap, documents, tools, ontologyTypes]);

  const handleMount: OnMount = (editor, monaco) => {
    // Register singleton provider (idempotent)
    ensureCompletionProvider(monaco, "liquid-markdown");
    // Register this editor's config by model URI
    const uri = editor.getModel()?.uri.toString();
    if (uri) {
      unregisterRef.current = registerEditorConfig(uri, configRef);
    }

    // Track empty state for placeholder
    setIsEmpty(editor.getValue() === "");
    editor.onDidChangeModelContent(() => {
      setIsEmpty(editor.getValue() === "");
    });

    editor.onDidDispose(() => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    });
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, []);

  const handleDiffMount: DiffOnMount = (editor) => {
    const modifiedEditor = editor.getModifiedEditor();
    modifiedEditor.onDidChangeModelContent(() => {
      onChangeRef.current(modifiedEditor.getValue());
    });
  };

  return (
    <div
      data-slot="md-editor"
      className={cn(
        "relative overflow-hidden rounded-md border border-border",
        className
      )}
      style={height ? { height } : undefined}
    >
      {isDiff ? (
        <MonacoDiffEditor
          original={original}
          modified={value}
          language="liquid-markdown"
          theme={theme}
          beforeMount={ensureMonacoSetup}
          onMount={handleDiffMount}
          options={{
            ...SHARED_OPTIONS,
            readOnly,
            renderSideBySide: false,
            fontSize: 14,
            wordWrap: "on",
          }}
        />
      ) : (
        <>
          <Editor
            language="liquid-markdown"
            value={value}
            onChange={(v) => onChange(v ?? "")}
            theme={theme}
            beforeMount={ensureMonacoSetup}
            onMount={handleMount}
            options={{
              ...SHARED_OPTIONS,
              readOnly,
              fontSize: 13,
              tabSize: 2,
              wordWrap: "on",
              lineNumbers: "on",
              hideCursorInOverviewRuler: true,
            }}
          />
          {isEmpty && placeholder && (
            <div className="pointer-events-none absolute top-0 left-[62px] py-0.5 text-sm text-muted-foreground">
              {placeholder}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export { MdEditor };
export type {
  MdEditorProps,
  CompletionDocument,
  CompletionTool,
  CompletionOntologyType,
};
