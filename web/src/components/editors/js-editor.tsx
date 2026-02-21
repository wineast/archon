"use client";

import { useRef } from "react";
import Editor, { DiffEditor as MonacoDiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { useDarkMode } from "./use-dark-mode";
import { ARCHON_LIGHT, ARCHON_DARK } from "./theme";
import { ensureMonacoSetup } from "./monaco-setup";

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

interface JsEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
  /** Pass original text to enable diff mode */
  original?: string;
}

export function JsEditor({
  value,
  onChange,
  readOnly = false,
  height,
  className,
  original,
}: JsEditorProps) {
  const isDark = useDarkMode();
  const theme = isDark ? ARCHON_DARK : ARCHON_LIGHT;
  const isDiff = original !== undefined;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
          language="typescript"
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
          language="typescript"
          value={value}
          onChange={(v) => onChange?.(v ?? "")}
          theme={theme}
          beforeMount={ensureMonacoSetup}
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
