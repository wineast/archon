import { db } from "@/db";
import { wikiDocuments, datasets, functions } from "@/db/schema";
import { eq, like, ilike } from "drizzle-orm";
import { renderWikiContent } from "@/lib/template/render";
import { parseWikiContent } from "@/lib/wiki/frontmatter";
import {
  renderField,
  renderObjectField,
  resolveDatasets,
} from "@/lib/datasets/queries";
import {
  resolveAndCompileFunctions,
  getCachedFunctions,
  setCachedFunctions,
  type FunctionRecord,
} from "@/lib/functions/compile";

export interface DataEntry {
  value: string;
  label: string | null;
  metadata: Record<string, unknown> | null;
}

export interface WikiDoc {
  meta: Record<string, unknown> | null;
  content: string;
}

export interface ToolContext {
  wiki: {
    get(id: string): Promise<WikiDoc | null>;
    findByPrefix(
      prefix: string
    ): Promise<Array<{ id: string; title: string; meta: Record<string, unknown> | null; content: string }>>;
    search(
      query: string
    ): Promise<Array<{ id: string; title: string; meta: Record<string, unknown> | null; content: string }>>;
  };
  dataset: {
    get(key: string): Promise<unknown>;
    getEntries(key: string): Promise<DataEntry[]>;
  };
  fn: (key: string) => Promise<(...args: unknown[]) => unknown>;
}

export function createToolContext(agentId?: string): ToolContext {
  let resolvedCache: Record<string, unknown> | null = null;
  let compiledFnsPromise: Promise<Map<string, unknown>> | null = null;

  async function getResolved(): Promise<Record<string, unknown>> {
    if (resolvedCache) return resolvedCache;
    if (!agentId) return {};

    const rows = await db
      .select({
        key: datasets.key,
        data: datasets.data,
      })
      .from(datasets)
      .where(eq(datasets.agentId, agentId));

    const { resolvedVars } = resolveDatasets(rows);
    resolvedCache = resolvedVars;
    return resolvedVars;
  }

  async function getCompiledFunctions(): Promise<Map<string, unknown>> {
    if (!agentId) return new Map();

    // Check cache first
    const cached = getCachedFunctions(agentId);
    if (cached) return cached;

    // Load from DB and compile
    const rows = await db
      .select({
        key: functions.key,
        code: functions.code,
        parameters: functions.parameters,
      })
      .from(functions)
      .where(eq(functions.agentId, agentId));

    const compiled = resolveAndCompileFunctions(rows as FunctionRecord[]);
    setCachedFunctions(agentId, compiled);
    return compiled;
  }

  return {
    wiki: {
      async get(id: string) {
        const row = await db
          .select({
            content: wikiDocuments.content,
            agentId: wikiDocuments.agentId,
          })
          .from(wikiDocuments)
          .where(eq(wikiDocuments.id, id))
          .limit(1)
          .then((rows) => rows[0]);
        if (!row) return null;
        const { meta, content: body } = parseWikiContent(row.content);
        const hasMeta = Object.keys(meta).length > 0 ? meta : null;
        if (row.agentId) {
          const rendered = await renderWikiContent(row.content, row.agentId, id);
          return { meta: hasMeta, content: rendered };
        }
        return { meta: hasMeta, content: body };
      },

      async findByPrefix(prefix: string) {
        const rows = await db
          .select({
            id: wikiDocuments.id,
            title: wikiDocuments.title,
            content: wikiDocuments.content,
          })
          .from(wikiDocuments)
          .where(like(wikiDocuments.id, `${prefix}%`));
        return rows.map((r) => {
          const { meta, content } = parseWikiContent(r.content);
          return { id: r.id, title: r.title, meta: Object.keys(meta).length > 0 ? meta : null, content };
        });
      },

      async search(query: string) {
        const rows = await db
          .select({
            id: wikiDocuments.id,
            title: wikiDocuments.title,
            content: wikiDocuments.content,
          })
          .from(wikiDocuments)
          .where(ilike(wikiDocuments.content, `%${query}%`));
        return rows.map((r) => {
          const { meta, content } = parseWikiContent(r.content);
          return { id: r.id, title: r.title, meta: Object.keys(meta).length > 0 ? meta : null, content };
        });
      },
    },

    dataset: {
      async get(key: string): Promise<unknown> {
        const all = await getResolved();
        return all[key] ?? null;
      },

      async getEntries(key: string): Promise<DataEntry[]> {
        const all = await getResolved();
        const val = all[key];
        if (!val || typeof val !== "object" || Array.isArray(val)) return [];
        return Object.entries(val as Record<string, unknown>).map(([k, v]) => ({
          value: k,
          label:
            (v as Record<string, unknown>)?.label as string | null ?? null,
          metadata: v as Record<string, unknown>,
        }));
      },
    },

    async fn(key: string) {
      // Lazy-load and compile all functions once per context
      if (!compiledFnsPromise) {
        compiledFnsPromise = getCompiledFunctions();
      }
      const compiled = await compiledFnsPromise;
      const result = compiled.get(key);
      if (!result) {
        throw new Error(`Function "${key}" not found`);
      }
      return result as (...args: unknown[]) => unknown;
    },
  };
}
