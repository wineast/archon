"use client";

import * as React from "react";
import Editor, { DiffEditor as MonacoDiffEditor, type OnMount, type DiffOnMount } from "@monaco-editor/react";
import type * as monacoNs from "monaco-editor";
import { cn } from "@/lib/utils";
import { useDarkMode } from "./use-dark-mode";
import { ARCHON_LIGHT, ARCHON_DARK } from "./theme";
import { ensureMonacoSetup } from "./monaco-setup";
import {
  createCompletionProvider,
  type CompletionConfig,
  type CompletionDocument,
  type CompletionTool,
} from "./completions";

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

interface MdEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  documents?: CompletionDocument[];
  tools?: CompletionTool[];
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
  documents = [],
  tools = [],
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
  const disposableRef = React.useRef<monacoNs.IDisposable | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Keep configRef up to date
  React.useEffect(() => {
    configRef.current = { variables, documents, tools };
  }, [variables, documents, tools]);

  const handleMount: OnMount = (editor, monaco) => {
    disposableRef.current = monaco.languages.registerCompletionItemProvider(
      "liquid-markdown",
      createCompletionProvider(configRef)
    );

    // Track empty state for placeholder
    setIsEmpty(editor.getValue() === "");
    editor.onDidChangeModelContent(() => {
      setIsEmpty(editor.getValue() === "");
    });

    editor.onDidDispose(() => {
      disposableRef.current?.dispose();
      disposableRef.current = null;
    });
  };

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
};
