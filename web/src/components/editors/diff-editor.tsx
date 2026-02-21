"use client";

import { useEffect, useRef } from "react";
import { EditorState, Compartment, ChangeSet, Text } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { unifiedMergeView, updateOriginalDoc, getOriginalDoc } from "@codemirror/merge";
import type { LanguageSupport } from "@codemirror/language";

interface DiffEditorProps {
  original: string;
  modified: string;
  readOnly?: boolean;
  onModifiedChange: (value: string) => void;
  /** CodeMirror language extension (e.g. javascript(), json()). */
  language: LanguageSupport;
}

export function DiffEditor({
  original,
  modified,
  readOnly = false,
  onModifiedChange,
  language,
}: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalUpdate = useRef(false);
  const onChangeRef = useRef(onModifiedChange);
  onChangeRef.current = onModifiedChange;
  const readOnlyCompartment = useRef(new Compartment());

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: modified,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        lineNumbers(),
        language,
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
            fontFamily: "var(--font-mono), ui-monospace, monospace",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-scroller": {
            overflow: "auto",
            fontFamily: "inherit",
            lineHeight: "1.625",
          },
          ".cm-content": { caretColor: "var(--foreground)" },
          ".cm-gutters": {
            backgroundColor: "var(--muted)",
            borderRight: "1px solid var(--border)",
          },
          ".cm-deletedChunk": {
            backgroundColor: "rgba(239, 68, 68, 0.1)",
          },
        }),
        unifiedMergeView({
          original,
          highlightChanges: true,
          gutter: true,
          mergeControls: false,
          syntaxHighlightDeletions: false,
        }),
        readOnlyCompartment.current.of([
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(readOnly),
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            isInternalUpdate.current = true;
            onChangeRef.current(update.state.doc.toString());
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== modified) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: modified },
      });
    }
  }, [modified]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    try {
      const origDoc = getOriginalDoc(view.state);
      const origStr = origDoc.toString();
      if (origStr !== original) {
        const changes = ChangeSet.of(
          { from: 0, to: origDoc.length, insert: original },
          origDoc.length
        );
        view.dispatch({
          effects: updateOriginalDoc.of({ doc: Text.of(original.split("\n")), changes }),
        });
      }
    } catch {
      // unified merge view not yet initialized
    }
  }, [original]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
    });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className="h-full [&_.cm-editor]:h-full [&_.cm-editor]:outline-none"
    />
  );
}
