"use client";

import { useRef, useEffect } from "react";
import Editor, { DiffEditor as MonacoDiffEditor, type OnMount, type DiffOnMount } from "@monaco-editor/react";
import type * as monacoNs from "monaco-editor";
import { cn } from "@/lib/utils";
import { useDarkMode } from "./use-dark-mode";
import { ARCHON_LIGHT, ARCHON_DARK } from "./theme";
import { ensureMonacoSetup } from "./monaco-setup";
import { createCompletionProvider, type CompletionConfig } from "./completions";

const SHARED_OPTIONS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  lineNumbersMinChars: 3,
  overviewRulerLanes: 0,
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
  original,
}: JsonEditorProps) {
  const isDark = useDarkMode();
  const theme = isDark ? ARCHON_DARK : ARCHON_LIGHT;
  const hasTemplateVars = templateVariables && templateVariables.length > 0;
  const language = hasTemplateVars ? "liquid-json" : "json";
  const isDiff = original !== undefined;

  const configRef = useRef<CompletionConfig | null>(null);
  const disposableRef = useRef<monacoNs.IDisposable | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Keep configRef up to date
  useEffect(() => {
    configRef.current = hasTemplateVars
      ? { variables: templateVariables, documents: [], tools: [] }
      : null;
  }, [templateVariables, hasTemplateVars]);

  const handleMount: OnMount = (editor, monaco) => {
    if (hasTemplateVars) {
      disposableRef.current = monaco.languages.registerCompletionItemProvider(
        "liquid-json",
        createCompletionProvider(configRef)
      );
    }
    editor.onDidDispose(() => {
      disposableRef.current?.dispose();
      disposableRef.current = null;
    });
  };

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
