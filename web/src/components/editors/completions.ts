import type * as monacoNs from "monaco-editor";

export interface CompletionDocument {
  title: string;
}

export interface CompletionTool {
  name: string;
  description?: string;
}

export interface CompletionConfig {
  variables: string[];
  /** When provided, object-typed values expand to {{key.field}} completions */
  variableMap?: Record<string, unknown>;
  documents: CompletionDocument[];
  tools: CompletionTool[];
}

export interface CompletionOption {
  label: string;
  type: "variable" | "keyword" | "function";
  detail: string;
  boost: number;
  apply: string;
  insertTextRules?: number;
}

/* ------------------------------------------------------------------ */
/*  Pure function: generates completion items (framework-agnostic)     */
/* ------------------------------------------------------------------ */

export function generateCompletions(
  textBeforeCursor: string,
  variables: string[],
  documents: CompletionDocument[],
  tools: CompletionTool[] = [],
  variableMap?: Record<string, unknown>
): { from: number; items: CompletionOption[] } | null {
  const lastOutputOpen = textBeforeCursor.lastIndexOf("{{");
  const lastTagOpen = textBeforeCursor.lastIndexOf("{%");
  const lastOpen = Math.max(lastOutputOpen, lastTagOpen);
  if (lastOpen === -1) return null;

  const afterOpen = textBeforeCursor.slice(lastOpen);
  if (afterOpen.includes("}}") || afterOpen.includes("%}")) return null;

  const from = lastOpen;
  const isTagContext = lastTagOpen > lastOutputOpen;

  const delimLen = 2;
  const typed = textBeforeCursor.slice(lastOpen + delimLen).trimStart();

  // Detect if user typed "key." to trigger nested completions
  const dotIndex = typed.indexOf(".");
  const nestedPrefix = dotIndex >= 0 ? typed.slice(0, dotIndex) : null;

  const options: CompletionOption[] = [
    // Dataset variables (only in {{ }} context)
    ...(!isTagContext
      ? nestedPrefix
        ? // After dot: show only matching variable's fields
          (() => {
            const val = variableMap?.[nestedPrefix];
            if (!val || typeof val !== "object" || Array.isArray(val)) return [];
            const fields = Object.keys(val as Record<string, unknown>);
            return fields.map((field, j) => ({
              label: `{{${nestedPrefix}.${field}}}`,
              type: "variable" as const,
              detail: String((val as Record<string, unknown>)[field] ?? ""),
              boost: 10 - j * 0.001,
              apply: `{{${nestedPrefix}.${field}}}`,
            }));
          })()
        : // Before dot: show only top-level keys
          variables.map((name, i) => ({
            label: `{{${name}}}`,
            type: "variable" as const,
            detail: "dataset",
            boost: 10 - i * 0.01,
            apply: `{{${name}}}`,
          }))
      : []),

    // Tools — nested object per tool
    ...(!isTagContext
      ? tools.flatMap((t, i) => {
          const detail = t.description || t.name;
          const base = 7 - i * 0.01;
          return [
            {
              label: `{{tool.${t.name}.name}}`,
              type: "variable" as const,
              detail: `${detail} (name)`,
              boost: base,
              apply: `{{tool.${t.name}.name}}`,
            },
            {
              label: `{{tool.${t.name}.description}}`,
              type: "variable" as const,
              detail: `${detail} (description)`,
              boost: base - 0.001,
              apply: `{{tool.${t.name}.description}}`,
            },
            {
              label: `{{tool.${t.name}.params}}`,
              type: "variable" as const,
              detail: `${detail} (params)`,
              boost: base - 0.002,
              apply: `{{tool.${t.name}.params}}`,
            },
            {
              label: `{{tool.${t.name}.parameters}}`,
              type: "variable" as const,
              detail: `${detail} (parameter array)`,
              boost: base - 0.003,
              apply: `{{tool.${t.name}.parameters}}`,
            },
            {
              label: `{{tool.${t.name}.json}}`,
              type: "variable" as const,
              detail: `${detail} (JSON)`,
              boost: base - 0.004,
              apply: `{{tool.${t.name}.json}}`,
            },
          ];
        })
      : []),

    // Top-level tool helpers
    ...(!isTagContext
      ? [
          {
            label: "{{tool_names}}",
            type: "variable" as const,
            detail: "all tool names",
            boost: 6.9,
            apply: "{{tool_names}}",
          },
          {
            label: "{{tool_entries}}",
            type: "variable" as const,
            detail: "tool array (for loop)",
            boost: 6.8,
            apply: "{{tool_entries}}",
          },
        ]
      : []),

    // Keywords with snippets
    {
      label: "{% if ... %}",
      type: "keyword" as const,
      detail: "conditional",
      boost: 5,
      apply: "{% if ${1:condition} %}\n$0\n{% endif %}",
      insertTextRules: 4, // InsertAsSnippet
    },
    {
      label: "{% unless ... %}",
      type: "keyword" as const,
      detail: "conditional",
      boost: 4,
      apply: "{% unless ${1:condition} %}\n$0\n{% endunless %}",
      insertTextRules: 4,
    },
    {
      label: "{% for ... %}",
      type: "keyword" as const,
      detail: "loop",
      boost: 3,
      apply: "{% for ${1:item} in ${2:list} %}\n$0\n{% endfor %}",
      insertTextRules: 4,
    },
    {
      label: "{% else %}",
      type: "keyword" as const,
      detail: "else branch",
      boost: 2,
      apply: "{% else %}",
    },

    // Documents
    ...documents.map((doc, i) => ({
      label: `{% include '${doc.title}' %}`,
      type: "function" as const,
      detail: "document",
      boost: 1 - i * 0.01,
      apply: `{% include '${doc.title}' %}`,
    })),
  ];

  // Filter by typed text
  const filtered = typed
    ? options.filter((o) => {
        const labelContent = o.label
          .replace(/^\{\{/, "")
          .replace(/\}\}$/, "")
          .replace(/^\{%\s*/, "")
          .replace(/\s*%\}$/, "");
        return labelContent.toLowerCase().includes(typed.toLowerCase());
      })
    : options;

  if (filtered.length === 0) return null;

  return { from, items: filtered };
}

/* ------------------------------------------------------------------ */
/*  Monaco adapter: singleton CompletionItemProvider per language      */
/* ------------------------------------------------------------------ */

function boostToSortText(boost: number): string {
  // Higher boost = smaller sort number = appears first
  const inverted = Math.max(0, 10000 - Math.round(boost * 100));
  return String(inverted).padStart(5, "0");
}

const completionKindMap: Record<string, number> = {
  variable: 5,  // CompletionItemKind.Variable
  keyword: 17,  // CompletionItemKind.Keyword
  function: 1,  // CompletionItemKind.Function
};

/**
 * Registry: maps model URI → config ref.
 * Multiple editors share one language-level provider; each editor
 * registers/unregisters its own config keyed by model URI.
 */
const configRegistry = new Map<string, React.RefObject<CompletionConfig | null>>();
const registeredLanguages = new Set<string>();

export function registerEditorConfig(
  modelUri: string,
  configRef: React.RefObject<CompletionConfig | null>
) {
  configRegistry.set(modelUri, configRef);
  return () => { configRegistry.delete(modelUri); };
}

export function ensureCompletionProvider(
  monaco: typeof monacoNs,
  language: string
) {
  if (registeredLanguages.has(language)) return;
  registeredLanguages.add(language);

  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ["{", "%", " ", "."],
    provideCompletionItems(model, position) {
      const configRef = configRegistry.get(model.uri.toString());
      const config = configRef?.current;
      if (!config) return { suggestions: [] };

      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const result = generateCompletions(
        textBeforeCursor,
        config.variables,
        config.documents,
        config.tools,
        config.variableMap
      );

      if (!result) return { suggestions: [] };

      // Calculate the range to replace
      const beforeCursorOnLine = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const lastOutput = beforeCursorOnLine.lastIndexOf("{{");
      const lastTag = beforeCursorOnLine.lastIndexOf("{%");
      const lastOnLine = Math.max(lastOutput, lastTag);

      const replaceStart = lastOnLine >= 0 ? lastOnLine + 1 : position.column;

      const range = {
        startLineNumber: position.lineNumber,
        startColumn: replaceStart,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };

      const suggestions: monacoNs.languages.CompletionItem[] = result.items.map(
        (item) => ({
          label: item.label,
          kind: completionKindMap[item.type] ?? 5,
          detail: item.detail,
          insertText: item.apply,
          insertTextRules: item.insertTextRules,
          sortText: boostToSortText(item.boost),
          range,
        })
      );

      return { suggestions };
    },
  });
}
