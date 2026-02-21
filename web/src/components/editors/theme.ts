import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

export const ARCHON_LIGHT = "archon-light";
export const ARCHON_DARK = "archon-dark";

let registered = false;

export function registerThemes(monaco: Monaco): void {
  if (registered) return;
  registered = true;

  monaco.editor.defineTheme(ARCHON_LIGHT, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "variable.liquid", foreground: "3b7dd8" },
      { token: "keyword.liquid", foreground: "9b35b0", fontStyle: "bold" },
      { token: "string.liquid", foreground: "2c8a50" },
      { token: "delimiter.liquid", foreground: "808080" },
      { token: "number.liquid", foreground: "3b7dd8" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1e1e1e",
    },
  });

  monaco.editor.defineTheme(ARCHON_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "variable.liquid", foreground: "7cb3f0" },
      { token: "keyword.liquid", foreground: "c78bd8", fontStyle: "bold" },
      { token: "string.liquid", foreground: "5dba82" },
      { token: "delimiter.liquid", foreground: "a0a0a0" },
      { token: "number.liquid", foreground: "7cb3f0" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
    },
  });
}
