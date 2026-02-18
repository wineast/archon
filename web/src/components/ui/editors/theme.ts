import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/* ------------------------------------------------------------------ */
/*  Shared color palette (OKLCH)                                       */
/*  CSS variables are unreliable in CodeMirror inline styles,          */
/*  so we use fixed OKLCH values here.                                 */
/* ------------------------------------------------------------------ */

const palette = {
  light: {
    variable:   "oklch(0.55 0.15 250)",       // blue
    variableBg: "oklch(0.55 0.15 250 / 0.08)",
    keyword:    "oklch(0.55 0.17 320)",        // magenta
    string:     "oklch(0.52 0.14 155)",        // green
    brace:      "oklch(0.556 0 0)",            // muted gray
  },
  dark: {
    variable:   "oklch(0.72 0.15 250)",
    variableBg: "oklch(0.72 0.15 250 / 0.1)",
    keyword:    "oklch(0.75 0.15 320)",
    string:     "oklch(0.72 0.14 155)",
    brace:      "oklch(0.708 0 0)",
  },
} as const;

/** Shared base theme for all editors (JsonEditor / JsEditor / MdEditor). */
export function editorBaseTheme(options?: { height?: string }): Extension {
  return EditorView.theme({
    "&": { fontSize: "13px", ...(options?.height ? { height: options.height } : {}) },
    ".cm-scroller": { overflow: "auto" },
    "&.cm-focused": { outline: "none" },
  });
}

/* ------------------------------------------------------------------ */
/*  Liquid syntax highlighting (MdEditor + JsonEditor template mode)   */
/*  Works via the Liquid language parser's syntax tree.                 */
/* ------------------------------------------------------------------ */

const highlightStyle = HighlightStyle.define([
  { tag: tags.variableName, color: palette.light.variable, backgroundColor: palette.light.variableBg, borderRadius: "3px", padding: "0 2px" },
  { tag: tags.keyword, color: palette.light.keyword, fontWeight: "bold" },
  { tag: tags.string, color: palette.light.string },
  { tag: tags.brace, color: palette.light.brace },
]);

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.variableName, color: palette.dark.variable, backgroundColor: palette.dark.variableBg, borderRadius: "3px", padding: "0 2px" },
  { tag: tags.keyword, color: palette.dark.keyword, fontWeight: "bold" },
  { tag: tags.string, color: palette.dark.string },
  { tag: tags.brace, color: palette.dark.brace },
]);

/**
 * Liquid / template syntax highlighting extension.
 * Used by both MdEditor and JsonEditor (in template mode).
 */
export function templateSyntaxHighlighting(isDark: boolean): Extension {
  return syntaxHighlighting(isDark ? darkHighlightStyle : highlightStyle);
}
