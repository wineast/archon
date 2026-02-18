import {
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
  snippetCompletion,
} from "@codemirror/autocomplete";

export interface CompletionDocument {
  title: string;
}

export interface CompletionTool {
  name: string;
  description?: string;
}

export function createCompletionSource(
  variables: string[],
  documents: CompletionDocument[],
  completionTools: CompletionTool[] = []
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.sliceString(0, context.pos);

    // Detect if we're inside {{ ... }} (output tag) or {% ... %} (control tag)
    const lastOutputOpen = line.lastIndexOf("{{");
    const lastTagOpen = line.lastIndexOf("{%");
    const lastOpen = Math.max(lastOutputOpen, lastTagOpen);
    if (lastOpen === -1) return null;

    // Check there's no closing delimiter after the opening
    const afterOpen = line.slice(lastOpen);
    if (afterOpen.includes("}}") || afterOpen.includes("%}")) return null;

    const from = lastOpen;
    const isTagContext = lastTagOpen > lastOutputOpen;

    // Get what's typed after the opening delimiter for filtering
    const delimLen = 2; // {{ or {%
    const typed = line.slice(lastOpen + delimLen).trimStart();

    const options = [
      // Dataset variables (only in {{ }} context)
      ...(!isTagContext
        ? variables.map((name, i) => ({
            label: `{{${name}}}`,
            type: "variable" as const,
            detail: "dataset",
            boost: 10 - i * 0.01,
            apply: `{{${name}}}`,
          }))
        : []),

      // Tools — nested object per tool (namespaced under tool.)
      ...(!isTagContext
        ? completionTools.flatMap((t, i) => {
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

      // Keywords with snippets (Liquid syntax)
      snippetCompletion("{% if ${condition} %}\n${}\n{% endif %}", {
        label: "{% if ... %}",
        type: "keyword",
        detail: "conditional",
        boost: 5,
      }),
      snippetCompletion(
        "{% unless ${condition} %}\n${}\n{% endunless %}",
        {
          label: "{% unless ... %}",
          type: "keyword",
          detail: "conditional",
          boost: 4,
        }
      ),
      snippetCompletion(
        "{% for ${item} in ${list} %}\n${}\n{% endfor %}",
        {
          label: "{% for ... %}",
          type: "keyword",
          detail: "loop",
          boost: 3,
        }
      ),
      snippetCompletion("{% else %}", {
        label: "{% else %}",
        type: "keyword",
        detail: "else branch",
        boost: 2,
      }),

      // Documents (include tag — Liquid syntax)
      ...documents.map((doc, i) => ({
        label: `{% include '${doc.title}' %}`,
        type: "function" as const,
        detail: "document",
        boost: 1 - i * 0.01,
        apply: `{% include '${doc.title}' %}`,
      })),
    ];

    // Filter by typed text if there's something typed
    const filtered = typed
      ? options.filter((o) => {
          // Strip delimiters for matching
          const labelContent = o.label
            .replace(/^\{\{/, "")
            .replace(/\}\}$/, "")
            .replace(/^\{%\s*/, "")
            .replace(/\s*%\}$/, "");
          return labelContent.toLowerCase().includes(typed.toLowerCase());
        })
      : options;

    if (filtered.length === 0) return null;

    return {
      from,
      options: filtered,
      validFor: /^[^}%]*$/,
    };
  };
}
