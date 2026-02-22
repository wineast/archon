"use client";

import { useRef, useEffect } from "react";
import Editor, { DiffEditor as MonacoDiffEditor, type OnMount, type DiffOnMount } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "./use-dark-mode";
import { ARCHON_LIGHT, ARCHON_DARK } from "./theme";
import { ensureMonacoSetup } from "./monaco-setup";
import {
  type CompletionConfig,
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

interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
  /** Pass variable names to enable {{}} template autocompletion */
  templateVariables?: string[];
  /** Pass variable name→data map to enable {{key.field}} nested completions */
  templateVariableMap?: Record<string, unknown>;
  /** Pass original text to enable diff mode */
  original?: string;
}

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  height,
  className,
  templateVariables,
  templateVariableMap,
  original,
}: JsonEditorProps) {
  const isDark = useDarkMode();
  const theme = isDark ? ARCHON_DARK : ARCHON_LIGHT;
  const hasTemplateVars = templateVariables && templateVariables.length > 0;
  const language = hasTemplateVars ? "liquid-json" : "json";
  const isDiff = original !== undefined;

  const configRef = useRef<CompletionConfig | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Keep configRef up to date
  useEffect(() => {
    configRef.current = hasTemplateVars
      ? { variables: templateVariables, variableMap: templateVariableMap, documents: [], tools: [] }
      : null;
  }, [templateVariables, templateVariableMap, hasTemplateVars]);

  const handleMount: OnMount = (editor, monaco) => {
    if (hasTemplateVars) {
      // Register singleton provider (idempotent)
      ensureCompletionProvider(monaco, "liquid-json");
      // Register this editor's config by model URI
      const uri = editor.getModel()?.uri.toString();
      if (uri) {
        unregisterRef.current = registerEditorConfig(uri, configRef);
      }
    }
    editor.onDidDispose(() => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    };
  }, []);

  const handleDiffMount: DiffOnMount = (editor) => {
    const modifiedEditor = editor.getModifiedEditor();
    modifiedEditor.onDidChangeModelContent(() => {
      onChangeRef.current?.(modifiedEditor.getValue());
    });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border",
        className
      )}
      style={height ? { height } : undefined}
    >
      {isDiff ? (
        <MonacoDiffEditor
          original={original}
          modified={value}
          language={language}
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
        <Editor
          language={language}
          value={value}
          onChange={(v) => onChange?.(v ?? "")}
          theme={theme}
          beforeMount={ensureMonacoSetup}
          onMount={handleMount}
          options={{
            ...SHARED_OPTIONS,
            readOnly,
            fontSize: 13,
            tabSize: 2,
            wordWrap: "off",
            hideCursorInOverviewRuler: true,
          }}
        />
      )}
    </div>
  );
}
