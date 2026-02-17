"use client";

import * as React from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, placeholder as cmPlaceholder, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";

import { cn } from "@/lib/utils";
import { liquid } from "./template-editor/language";
import { templateEditorTheme } from "./template-editor/theme";
import {
  createCompletionSource,
  type CompletionDocument,
  type CompletionLookup,
  type CompletionTool,
} from "./template-editor/completions";

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  documents?: CompletionDocument[];
  lookups?: CompletionLookup[];
  tools?: CompletionTool[];
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

function TemplateEditor({
  value,
  onChange,
  variables = [],
  documents = [],
  lookups = [],
  tools = [],
  placeholder = "",
  className,
  minHeight,
}: TemplateEditorProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const isInternalUpdate = React.useRef(false);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Compartments for dynamic reconfiguration
  const completionCompartment = React.useRef(new Compartment());
  const placeholderCompartment = React.useRef(new Compartment());
  const themeCompartment = React.useRef(new Compartment());

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
        override: [createCompletionSource(variables, documents, lookups, tools)],
        activateOnTyping: true,
      })
    );

    const placeholderExt = placeholderCompartment.current.of(
      cmPlaceholder(placeholder)
    );

    const themeExt = themeCompartment.current.of(
      templateEditorTheme(isDark)
    );

    const state = EditorState.create({
      doc: value,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        liquid(),
        themeExt,
        completionExt,
        placeholderExt,
        EditorView.lineWrapping,
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
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Reconfigure completions when variables/documents change
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: completionCompartment.current.reconfigure(
        autocompletion({
          override: [createCompletionSource(variables, documents, lookups, tools)],
          activateOnTyping: true,
        })
      ),
    });
  }, [variables, documents, lookups, tools]);

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

  // Reconfigure theme on dark mode change
  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeCompartment.current.reconfigure(
        templateEditorTheme(isDark)
      ),
    });
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      data-slot="template-editor"
      style={minHeight ? { minHeight } : undefined}
      className={cn(
        "border-input dark:bg-input/30 overflow-hidden rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        className
      )}
    />
  );
}

export { TemplateEditor };
export type {
  TemplateEditorProps,
  CompletionDocument,
  CompletionLookup,
  CompletionTool,
};
