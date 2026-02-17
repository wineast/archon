"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab } from "@codemirror/commands";
import { cn } from "@/lib/utils";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "javascript" | "json";
  readOnly?: boolean;
  height?: string;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  readOnly = false,
  height = "300px",
  className,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Track internal value to avoid unnecessary external updates
  const internalValueRef = useRef(value);

  // Create editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const langExtension = language === "json" ? json() : javascript();

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        langExtension,
        oneDark,
        keymap.of([indentWithTab]),
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            internalValueRef.current = newValue;
            onChangeRef.current?.(newValue);
          }
        }),
        EditorView.theme({
          "&": { height, fontSize: "13px" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate editor when language or readOnly changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly, height]);

  // Sync external value changes (avoid cursor jump)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === internalValueRef.current) return;

    internalValueRef.current = value;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-md border border-border",
        className
      )}
    />
  );
}
