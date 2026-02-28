import { Liquid } from "liquidjs";
import { registerBuiltinFilters } from "@/lib/template/filters";

// Shared Liquid instance for judge prompt rendering (simple variable substitution).
const liquid = new Liquid({ jsTruthy: true });
registerBuiltinFilters(liquid);

// ── Default templates ──

export const DEFAULT_PROMPT_TEMPLATE = `\
{% if mode == "single" -%}
User Input: {{ user_input }}
{%- else -%}
Conversation:
{{ conversation }}
{%- endif %}

{% if expected_output -%}
Expected Output: {{ expected_output }}
{%- endif %}

{% if mode == "single" -%}
Actual Response: {{ actual_response }}
{%- endif %}`;

export const DEFAULT_TURN_PROMPT_TEMPLATE = `\
Conversation:
{{ conversation }}

{% if expected_output -%}
Expected Output: {{ expected_output }}
{%- endif %}`;

// ── Render function ──

export interface JudgePromptVars {
  mode: string;
  user_input: string;
  expected_output: string;
  actual_response: string;
  conversation: string;
}

/**
 * Render a judge prompt template with the given variables.
 * Falls back to the appropriate default template when template is null/empty or on render error.
 */
export async function renderJudgePrompt(
  template: string | null | undefined,
  vars: JudgePromptVars,
  isPerTurn: boolean,
): Promise<string> {
  const defaultTemplate = isPerTurn ? DEFAULT_TURN_PROMPT_TEMPLATE : DEFAULT_PROMPT_TEMPLATE;
  const tpl = template || defaultTemplate;

  try {
    const result = await liquid.parseAndRender(tpl, vars);
    return result.trim();
  } catch {
    // Syntax error in custom template — fallback to default
    const result = await liquid.parseAndRender(defaultTemplate, vars);
    return result.trim();
  }
}
