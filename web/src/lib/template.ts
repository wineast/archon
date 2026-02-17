export type TemplateVars = Record<string, string>;

function getBuiltinVars(context: {
  model?: string;
  caseCount?: number;
  caseName?: string;
  toolNames?: string[];
}): TemplateVars {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    datetime: now.toISOString(),
    timestamp: String(now.getTime()),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
    model: context.model ?? "",
    caseCount: String(context.caseCount ?? 0),
    caseName: context.caseName ?? "",
  };
}

/**
 * Resolve `{{var}}` placeholders in a template string.
 * Priority: built-in < tool names < custom vars.
 */
export function resolveTemplate(
  template: string,
  customVars: TemplateVars,
  context: {
    model?: string;
    caseCount?: number;
    caseName?: string;
    toolNames?: string[];
  } = {}
): string {
  const builtins = getBuiltinVars(context);

  // Tool names resolve to themselves so prompts can reference tools
  const toolVars: TemplateVars = {};
  if (context.toolNames) {
    for (const name of context.toolNames) {
      toolVars[name] = name;
    }
  }

  const merged = { ...builtins, ...toolVars, ...customVars };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in merged ? merged[key] : match;
  });
}

/** List all available built-in variable names. */
export const BUILTIN_VAR_NAMES = [
  "date",
  "time",
  "datetime",
  "timestamp",
  "year",
  "month",
  "day",
  "model",
  "caseCount",
  "caseName",
] as const;
