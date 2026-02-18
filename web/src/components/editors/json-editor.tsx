"use client";

import { useEffect, useRef, useState } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import { cn } from "@/lib/utils";
import { liquid } from "./language";
import { editorBaseTheme, templateSyntaxHighlighting } from "./theme";
import { createCompletionSource } from "./completions";

interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
  /** Pass variable names to enable {{}} template autocompletion */
  templateVariables?: string[];
}

export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  height = "300px",
  className,
  templateVariables,
}: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const internalValueRef = useRef(value);

  // Compartment for dynamic autocompletion reconfiguration
  const completionCompartment = useRef(new Compartment());

  // Detect dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const check = () => setIsDark(el.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Create editor
  useEffect(() => {
    if (!containerRef.current) return;

    const completionExt = completionCompartment.current.of(
      templateVariables && templateVariables.length > 0
        ? autocompletion({
            override: [createCompletionSource(templateVariables, [])],
            activateOnTyping: true,
          })
        : []
    );

    const hasTemplateVars = templateVariables && templateVariables.length > 0;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        // Template mode: Liquid parser (same as MdEditor); plain mode: JSON parser
        ...(hasTemplateVars
          ? [liquid(), templateSyntaxHighlighting(isDark)]
          : [json()]),
        ...(isDark ? [oneDark] : []),
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
        editorBaseTheme({ height }),
        completionExt,
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
  }, [readOnly, height, isDark]);

  // Reconfigure autocompletion when templateVariables change
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: completionCompartment.current.reconfigure(
        templateVariables && templateVariables.length > 0
          ? autocompletion({
              override: [createCompletionSource(templateVariables, [])],
              activateOnTyping: true,
            })
          : []
      ),
    });
  }, [templateVariables]);

  // Sync external value changes
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
