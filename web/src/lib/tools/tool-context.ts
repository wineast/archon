import { db } from "@/db";
import { wikiDocuments, lookupTables, lookupEntries, dataObjects } from "@/db/schema";
import { eq, like, ilike } from "drizzle-orm";
import {
  renderWikiContent,
  renderEntryField,
  renderMetadataField,
} from "@/lib/template/render";
import { parseWikiContent } from "@/lib/wiki/frontmatter";
import { getTemplateVars } from "@/lib/template-vars/queries";

export interface LookupEntry {
  value: string;
  label: string | null;
  metadata: Record<string, unknown> | null;
}

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
  lookup: {
    get(key: string): Promise<LookupEntry[]>;
    find(
      key: string,
      filter: Record<string, unknown>
    ): Promise<LookupEntry[]>;
  };
  data: {
    get(key: string): Promise<DataEntry[]>;
    find(
      key: string,
      filter: Record<string, unknown>
    ): Promise<DataEntry[]>;
  };
  vars: {
    get(key: string): Promise<string | null>;
  };
}

function filterEntries<T extends { metadata: Record<string, unknown> | null }>(
  entries: T[],
  filter: Record<string, unknown>
): T[] {
  return entries.filter((entry) => {
    if (!entry.metadata) return false;
    for (const [k, v] of Object.entries(filter)) {
      const metaVal = entry.metadata[k];
      if (Array.isArray(metaVal)) {
        if (!metaVal.includes(v)) return false;
      } else if (metaVal !== v) {
        return false;
      }
    }
    return true;
  });
}

export function createToolContext(agentId?: string): ToolContext {
  let varsCache: Record<string, unknown> | null = null;
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

    lookup: {
      async get(key: string): Promise<LookupEntry[]> {
        if (!varsCache && agentId) {
          varsCache = await getTemplateVars(agentId);
        }
        const vars = varsCache ?? {};

        const [table] = await db
          .select({ id: lookupTables.id })
          .from(lookupTables)
          .where(eq(lookupTables.key, key))
          .limit(1);

        if (!table) return [];

        const entries = await db
          .select({
            value: lookupEntries.value,
            label: lookupEntries.label,
            metadata: lookupEntries.metadata,
          })
          .from(lookupEntries)
          .where(eq(lookupEntries.tableId, table.id))
          .orderBy(lookupEntries.order);

        return (entries as LookupEntry[]).map((e) => ({
          ...e,
          value: renderEntryField(e.value, vars),
          label: e.label ? renderEntryField(e.label, vars) : e.label,
          metadata: e.metadata ? renderMetadataField(e.metadata, vars) : e.metadata,
        }));
      },

      async find(
        key: string,
        filter: Record<string, unknown>
      ): Promise<LookupEntry[]> {
        const all = await this.get(key);
        return filterEntries(all, filter);
      },
    },

    data: {
      async get(key: string): Promise<DataEntry[]> {
        if (!varsCache && agentId) {
          varsCache = await getTemplateVars(agentId);
        }
        const vars = varsCache ?? {};

        const [obj] = await db
          .select({ data: dataObjects.data })
          .from(dataObjects)
          .where(eq(dataObjects.key, key))
          .limit(1);

        if (!obj?.data) return [];

        const rendered = renderMetadataField(
          obj.data as Record<string, unknown>,
          vars
        );
        return Object.entries(rendered).map(([k, v]) => ({
          value: k,
          label: (v as Record<string, unknown>)?.label as string | null ?? null,
          metadata: v as Record<string, unknown>,
        }));
      },

      async find(
        key: string,
        filter: Record<string, unknown>
      ): Promise<DataEntry[]> {
        const all = await this.get(key);
        return filterEntries(all, filter);
      },
    },

    vars: {
      async get(key: string): Promise<string | null> {
        if (!agentId) return null;
        if (!varsCache) {
          varsCache = await getTemplateVars(agentId);
        }
        const val = varsCache![key];
        return val != null ? String(val) : null;
      },
    },
  };
}
