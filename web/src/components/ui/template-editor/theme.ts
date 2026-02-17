import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

export const editorTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    fontFamily: "var(--font-mono), ui-monospace, monospace",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.625",
    padding: "8px 12px",
  },
  ".cm-content": {
    caretColor: "var(--foreground)",
    padding: "0",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
  },
  // Hide gutters
  ".cm-gutters": {
    display: "none",
  },
  // Autocomplete panel
  ".cm-tooltip-autocomplete": {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul": {
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    fontSize: "13px",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "4px 8px",
    borderRadius: "0",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionIcon": {
    display: "none",
  },
  ".cm-completionLabel": {
    fontFamily: "var(--font-mono), ui-monospace, monospace",
  },
  ".cm-completionDetail": {
    fontStyle: "normal",
    fontSize: "11px",
    opacity: "0.6",
    marginLeft: "8px",
  },
  // Active line (subtle)
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  // Selection
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--accent)",
  },
});

// Use fixed OKLCH values because HighlightStyle generates inline styles
// where CSS custom properties are unreliable.
const highlightColors = {
  // Light mode values (dark mode overridden via .dark class below)
  variableName: "oklch(0.55 0.15 250)", // blue
  variableNameBg: "oklch(0.55 0.15 250 / 0.08)",
  keyword: "oklch(0.55 0.17 320)", // magenta
  string: "oklch(0.52 0.14 155)", // green
  brace: "oklch(0.556 0 0)", // muted gray
};

const highlightStyle = HighlightStyle.define([
  {
    tag: tags.variableName,
    color: highlightColors.variableName,
    backgroundColor: highlightColors.variableNameBg,
    borderRadius: "3px",
    padding: "0 2px",
  },
  {
    tag: tags.keyword,
    color: highlightColors.keyword,
    fontWeight: "bold",
  },
  {
    tag: tags.string,
    color: highlightColors.string,
  },
  {
    tag: tags.brace,
    color: highlightColors.brace,
  },
]);

// Dark mode overrides via EditorView.theme
const darkOverrides = EditorView.theme(
  {
    // Override highlight colors in dark mode with data attributes on cm spans
  },
  { dark: true }
);

// Dark mode highlight style
const darkHighlightStyle = HighlightStyle.define([
  {
    tag: tags.variableName,
    color: "oklch(0.72 0.15 250)",
    backgroundColor: "oklch(0.72 0.15 250 / 0.1)",
    borderRadius: "3px",
    padding: "0 2px",
  },
  {
    tag: tags.keyword,
    color: "oklch(0.75 0.15 320)",
    fontWeight: "bold",
  },
  {
    tag: tags.string,
    color: "oklch(0.72 0.14 155)",
  },
  {
    tag: tags.brace,
    color: "oklch(0.708 0 0)",
  },
]);

export function templateEditorTheme(isDark: boolean): Extension {
  return [
    editorTheme,
    isDark
      ? [darkOverrides, syntaxHighlighting(darkHighlightStyle)]
      : syntaxHighlighting(highlightStyle),
  ];
}

/** Syntax highlighting only — no editor chrome (gutters visible, no padding overrides) */
export function templateSyntaxHighlighting(isDark: boolean): Extension {
  return isDark
    ? [darkOverrides, syntaxHighlighting(darkHighlightStyle)]
    : syntaxHighlighting(highlightStyle);
}
