"use client";

import * as React from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, placeholder as cmPlaceholder, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion } from "@codemirror/autocomplete";

import { cn } from "@/lib/utils";
import { liquid } from "./language";
import { editorBaseTheme, templateSyntaxHighlighting } from "./theme";
import {
  createCompletionSource,
  type CompletionDocument,
  type CompletionTool,
} from "./completions";

interface MdEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  documents?: CompletionDocument[];
  tools?: CompletionTool[];
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

function MdEditor({
  value,
  onChange,
  variables = [],
  documents = [],
  tools = [],
  placeholder = "",
  className,
  minHeight,
}: MdEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const isInternalUpdate = React.useRef(false);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Compartments for dynamic reconfiguration
  const completionCompartment = React.useRef(new Compartment());
  const placeholderCompartment = React.useRef(new Compartment());

  // Detect dark mode
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const el = document.documentElement;
    const check = () => setIsDark(el.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Initialize editor
  React.useEffect(() => {
    if (!containerRef.current) return;

    const completionExt = completionCompartment.current.of(
      autocompletion({
        override: [createCompletionSource(variables, documents, tools)],
        activateOnTyping: true,
      })
    );

    const placeholderExt = placeholderCompartment.current.of(
      cmPlaceholder(placeholder)
    );

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        liquid(),
        templateSyntaxHighlighting(isDark),
        ...(isDark ? [oneDark] : []),
        completionExt,
        placeholderExt,
        EditorView.lineWrapping,
        editorBaseTheme(),
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
    // Recreate editor when dark mode changes (same as JsonEditor/JsEditor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // Sync external value changes → CM
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  // Reconfigure completions when variables/documents/tools change
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: completionCompartment.current.reconfigure(
        autocompletion({
          override: [createCompletionSource(variables, documents, tools)],
          activateOnTyping: true,
        })
      ),
    });
  }, [variables, documents, tools]);

  // Reconfigure placeholder
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: placeholderCompartment.current.reconfigure(
        cmPlaceholder(placeholder)
      ),
    });
  }, [placeholder]);

  return (
    <div
      ref={containerRef}
      data-slot="md-editor"
      style={minHeight ? { minHeight } : undefined}
      className={cn(
        "overflow-hidden rounded-md border border-border",
        className
      )}
    />
  );
}

export { MdEditor };
export type {
  MdEditorProps,
  CompletionDocument,
  CompletionTool,
};
