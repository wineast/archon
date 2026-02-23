import { Liquid, Tag, type TopLevelToken, type TagToken, type Context, type Emitter } from "liquidjs";
import type { WikiDocument } from "./types";
import { stripFrontmatter } from "./frontmatter";
import { registerBuiltinFilters } from "@/lib/template/filters";
import type { FunctionsSandbox } from "@/lib/functions/sandbox";

export interface TemplateContext {
  documents: WikiDocument[];
  currentDoc: WikiDocument;
  variables?: Record<string, unknown>;
  /** QuickJS sandbox with compiled agent functions (for template filters/tags). */
  fnSandbox?: FunctionsSandbox;
}

/** Build the data context with built-in + custom variables */
function buildContext(ctx: TemplateContext): Record<string, unknown> {
  const now = new Date();
  return {
    currentDate: now.toLocaleDateString("en-US"),
    currentTime: now.toLocaleTimeString("en-US"),
    documentTitle: ctx.currentDoc.name,
    ...ctx.variables,
  };
}

/**
 * Process LiquidJS template syntax in wiki content.
 * Supports: {{variable}}, {% if %}, {% for %}, {% include 'key' %}, {{lookup.key}},
 * function filters ({{ data | fn_key }}), and {% fn %} tag.
 */
export function processTemplate(
  content: string,
  ctx: TemplateContext,
  visited?: Set<string>
): string {
  const visitedSet = visited ?? new Set([ctx.currentDoc.id]);

  // Create Liquid engine: no HTML escaping (AI prompts, not web pages)
  const engine = new Liquid({ jsTruthy: true });

  // Register shared built-in filters (json, keys, values)
  registerBuiltinFilters(engine);

  // Register custom {% include 'key' %} tag for wiki document embedding
  engine.registerTag("include", class IncludeDocTag extends Tag {
    private key = "";

    constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
      super(token, remainTokens, liquid);
      // Parse the key: strip surrounding quotes
      this.key = token.args.trim().replace(/^['"]|['"]$/g, "");
    }

    *render(_context: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      const doc = ctx.documents.find((d) => d.key === this.key);
      if (!doc) {
        emitter.write(`> Document not found: ${this.key}`);
        return;
      }
      if (visitedSet.has(doc.id)) {
        emitter.write(`> Circular reference: ${doc.name}`);
        return;
      }

      const nextVisited = new Set(visitedSet);
      nextVisited.add(doc.id);
      const rendered = processTemplate(
        stripFrontmatter(doc.content),
        { ...ctx, currentDoc: doc },
        nextVisited
      );
      emitter.write(rendered);
    }
  });

  // Register function filters and {% fn %} tag when sandbox is available
  if (ctx.fnSandbox) {
    const sandbox = ctx.fnSandbox;

    // Register each function as a Liquid filter: {{ data | fn_key }}
    for (const key of sandbox.keys) {
      engine.registerFilter(key, (input: unknown) => {
        try {
          return sandbox.call(key, input);
        } catch {
          return "";
        }
      });
    }

    // Register {% fn name [input_var] %} tag
    engine.registerTag("fn", class FnTag extends Tag {
      private fnName = "";
      private inputVar = "";

      constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
        super(token, remainTokens, liquid);
        const parts = token.args.trim().split(/\s+/);
        this.fnName = parts[0] ?? "";
        this.inputVar = parts[1] ?? "";
      }

      *render(context: Context, emitter: Emitter): Generator<unknown, void, unknown> {
        try {
          let input: unknown;
          if (this.inputVar) {
            input = context.get([this.inputVar]);
          }
          const result = sandbox.call(this.fnName, input);
          if (result !== null && result !== undefined && typeof result === "object") {
            emitter.write(JSON.stringify(result));
          } else {
            emitter.write(String(result ?? ""));
          }
        } catch {
          emitter.write("");
        }
      }
    });
  }

  try {
    return engine.parseAndRenderSync(content, buildContext(ctx));
  } catch {
    // If template compilation fails, return original content
    return content;
  }
}
