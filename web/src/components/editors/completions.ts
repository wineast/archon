import type * as monacoNs from "monaco-editor";

export interface CompletionDocument {
  key: string;
  title: string;
}

export interface CompletionTool {
  name: string;
  description?: string;
}

export interface CompletionOntologyType {
  key: string;
  name: string;
}

export interface CompletionFunction {
  key: string;
  name: string;
  description?: string;
}

export interface CompletionConfig {
  variables: string[];
  /** When provided, object-typed values expand to {{key.field}} completions */
  variableMap?: Record<string, unknown>;
  documents: CompletionDocument[];
  tools: CompletionTool[];
  ontologyTypes?: CompletionOntologyType[];
  functions?: CompletionFunction[];
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
  variableMap?: Record<string, unknown>,
  ontologyTypes?: CompletionOntologyType[],
  functions?: CompletionFunction[]
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
              label: `{{tool.${t.name}.parameters}}`,
              type: "variable" as const,
              detail: `${detail} (parameter array)`,
              boost: base - 0.002,
              apply: `{{tool.${t.name}.parameters}}`,
            },
          ];
        })
      : []),

    // Top-level tool helpers
    ...(!isTagContext
      ? [
          {
            label: "{{tool_entries}}",
            type: "variable" as const,
            detail: "tool array (for loop)",
            boost: 6.9,
            apply: "{{tool_entries}}",
          },
        ]
      : []),

    // Ontology — nested object per type
    ...(!isTagContext && ontologyTypes
      ? ontologyTypes.flatMap((t, i) => {
          const detail = t.name || t.key;
          const base = 6.5 - i * 0.01;
          return [
            {
              label: `{{ontology.${t.key}.name}}`,
              type: "variable" as const,
              detail: `${detail} (name)`,
              boost: base,
              apply: `{{ontology.${t.key}.name}}`,
            },
            {
              label: `{{ontology.${t.key}.description}}`,
              type: "variable" as const,
              detail: `${detail} (description)`,
              boost: base - 0.001,
              apply: `{{ontology.${t.key}.description}}`,
            },
            {
              label: `{{ontology.${t.key}.properties}}`,
              type: "variable" as const,
              detail: `${detail} (properties)`,
              boost: base - 0.002,
              apply: `{{ontology.${t.key}.properties}}`,
            },
            {
              label: `{{ontology.${t.key}.relations}}`,
              type: "variable" as const,
              detail: `${detail} (relations)`,
              boost: base - 0.003,
              apply: `{{ontology.${t.key}.relations}}`,
            },
          ];
        })
      : []),

    // Top-level ontology helper
    ...(!isTagContext && ontologyTypes && ontologyTypes.length > 0
      ? [
          {
            label: "{{ontology_types}}",
            type: "variable" as const,
            detail: "ontology types array",
            boost: 6.4,
            apply: "{{ontology_types}}",
          },
        ]
      : []),

    // Function filter completions ({{ value | fn_key }}) in {{ context
    ...(!isTagContext && functions
      ? functions.map((f, i) => ({
          label: `{{ value | ${f.key} }}`,
          type: "function" as const,
          detail: f.description || f.name,
          boost: 6.2 - i * 0.01,
          apply: `{{ \${1:value} | ${f.key} }}`,
          insertTextRules: 4, // InsertAsSnippet
        }))
      : []),

    // Function tag completions ({% fn key input %}) in {% context
    ...(isTagContext && functions
      ? functions.map((f, i) => ({
          label: `{% fn ${f.key} %}`,
          type: "function" as const,
          detail: f.description || f.name,
          boost: 6.2 - i * 0.01,
          apply: `{% fn ${f.key} \${1:input} %}`,
          insertTextRules: 4, // InsertAsSnippet
        }))
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
      label: `{% include '${doc.key}' %}`,
      type: "function" as const,
      detail: doc.title,
      boost: 1 - i * 0.01,
      apply: `{% include '${doc.key}' %}`,
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
        config.variableMap,
        config.ontologyTypes,
        config.functions
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
