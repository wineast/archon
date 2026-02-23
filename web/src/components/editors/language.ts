import type * as monacoNs from "monaco-editor";

type Monaco = typeof monacoNs;

/* ------------------------------------------------------------------ */
/*  Liquid base tokenizer rules                                       */
/* ------------------------------------------------------------------ */

const liquidRules: monacoNs.languages.IMonarchLanguageRule[] = [
  // Output tag  {{ ... }}
  [/\{\{/, { token: "delimiter.liquid", next: "@liquidOutput" }],
  // Control tag {% ... %}
  [/\{%/, { token: "delimiter.liquid", next: "@liquidTag" }],
];

const liquidOutputState: monacoNs.languages.IMonarchLanguageRule[] = [
  [/\}\}/, { token: "delimiter.liquid", next: "@pop" }],
  [/\|/, "keyword.liquid"],
  [/"[^"]*"/, "string.liquid"],
  [/'[^']*'/, "string.liquid"],
  [/\d+(\.\d+)?/, "number.liquid"],
  [/[a-zA-Z_][\w./-]*/, "variable.liquid"],
  [/\s+/, ""],
  [/./, ""],
];

const liquidTagState: monacoNs.languages.IMonarchLanguageRule[] = [
  [/%\}/, { token: "delimiter.liquid", next: "@pop" }],
  [
    /\b(?:if|elsif|else|endif|for|endfor|unless|endunless|include|comment|endcomment|assign|capture|endcapture|in|fn)\b/,
    "keyword.liquid",
  ],
  [/\b(?:==|!=|<=|>=|<|>|and|or|not|contains)\b/, "keyword.liquid"],
  [/"[^"]*"/, "string.liquid"],
  [/'[^']*'/, "string.liquid"],
  [/[a-zA-Z_][\w./-]*/, "variable.liquid"],
  [/\s+/, ""],
  [/./, ""],
];

/* ------------------------------------------------------------------ */
/*  Register languages                                                */
/* ------------------------------------------------------------------ */

let registered = false;

export function registerLanguages(monaco: Monaco): void {
  if (registered) return;
  registered = true;

  // Pure Liquid
  monaco.languages.register({ id: "liquid" });
  monaco.languages.setMonarchTokensProvider("liquid", {
    tokenizer: {
      root: [
        ...liquidRules,
        [/.+?(?=\{[{%])/, ""], // plain text before next delimiter
        [/.+$/, ""],           // rest of line
      ],
      liquidOutput: [...liquidOutputState],
      liquidTag: [...liquidTagState],
    },
  });

  // Liquid-JSON: JSON with embedded Liquid
  monaco.languages.register({ id: "liquid-json" });
  monaco.languages.setMonarchTokensProvider("liquid-json", {
    tokenizer: {
      root: [
        ...liquidRules,
        // JSON tokens
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, "string.key.json"],
        [/"(?:[^"\\]|\\.)*"/, "string.value.json"],
        [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number.json"],
        [/\b(?:true|false)\b/, "keyword.json"],
        [/\bnull\b/, "keyword.json"],
        [/[{}[\]]/, "delimiter.bracket.json"],
        [/[,:]/, "delimiter.json"],
        [/\s+/, ""],
      ],
      liquidOutput: [...liquidOutputState],
      liquidTag: [...liquidTagState],
    },
  });

  // Liquid-Markdown: Markdown with embedded Liquid
  monaco.languages.register({ id: "liquid-markdown" });
  monaco.languages.setMonarchTokensProvider("liquid-markdown", {
    tokenizer: {
      root: [
        ...liquidRules,
        // Markdown headings
        [/^#{1,6}\s.*$/, "keyword.md"],
        // Bold
        [/\*\*[^*]+\*\*/, "strong.md"],
        [/__[^_]+__/, "strong.md"],
        // Italic
        [/\*[^*]+\*/, "emphasis.md"],
        [/_[^_]+_/, "emphasis.md"],
        // Inline code
        [/`[^`]+`/, "variable.md"],
        // Links [text](url)
        [/\[([^\]]+)\]\([^)]+\)/, "string.link.md"],
        // Horizontal rule
        [/^---+$/, "keyword.md"],
        // List markers
        [/^\s*[-*+]\s/, "keyword.md"],
        [/^\s*\d+\.\s/, "keyword.md"],
        // Catch-all
        [/./, ""],
      ],
      liquidOutput: [...liquidOutputState],
      liquidTag: [...liquidTagState],
    },
  });
}
