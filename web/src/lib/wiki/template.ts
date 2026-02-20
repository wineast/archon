import { Liquid, Tag, type TopLevelToken, type TagToken, type Context, type Emitter } from "liquidjs";
import type { WikiDocument } from "./types";
import { stripFrontmatter } from "./frontmatter";

export interface TemplateContext {
  documents: WikiDocument[];
  currentDoc: WikiDocument;
  variables?: Record<string, unknown>;
}

/** Build the data context with built-in + custom variables */
function buildContext(ctx: TemplateContext): Record<string, unknown> {
  const now = new Date();
  return {
    currentDate: now.toLocaleDateString("en-US"),
    currentTime: now.toLocaleTimeString("en-US"),
    documentTitle: ctx.currentDoc.name,
    documentCount: ctx.documents.length,
    documentList: ctx.documents.map((d) => d.name),
    ...ctx.variables,
  };
}

/**
 * Process LiquidJS template syntax in wiki content.
 * Supports: {{variable}}, {% if %}, {% for %}, {% include 'key' %}, {{lookup.key}}
 */
export function processTemplate(
  content: string,
  ctx: TemplateContext,
  visited?: Set<string>
): string {
  const visitedSet = visited ?? new Set([ctx.currentDoc.id]);

  // Create Liquid engine: no HTML escaping (AI prompts, not web pages)
  const engine = new Liquid({ jsTruthy: true });

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

  try {
    return engine.parseAndRenderSync(content, buildContext(ctx));
  } catch {
    // If template compilation fails, return original content
    return content;
  }
}
