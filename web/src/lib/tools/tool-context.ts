import { db } from "@/db";
import {
  wikiDocuments,
  schemas,
  objectTypes,
  objectRelations,
  objectInstances,
  objectLinks,
} from "@/db/schema";
import { eq, and, like, ilike, inArray, or, sql, isNull } from "drizzle-orm";
import { renderWikiContent } from "@/lib/template/render";
import { parseWikiContent } from "@/lib/wiki/frontmatter";
import { resolveDatasets } from "@/lib/datasets/queries";
import {
  resolveAndCompileFunctions,
  getCachedFunctions,
  setCachedFunctions,
  ALL_BASE_DEPS,
  type FunctionRecord,
} from "@/lib/functions/compile";
import {
  getAgentDatasets,
  getAgentFunctions,
} from "@/lib/pool/queries";
import { extractLabel } from "@/lib/ontology/utils";
import { proxyToExternal } from "@/lib/ontology/external-proxy";
import { getDefsMap } from "@/lib/schemas/resolve-inline";

export interface WikiDoc {
  meta: Record<string, unknown> | null;
  content: string;
}

export interface OntologyContext {
  types(): Promise<Array<{ key: string; name: string; description: string }>>;
  type(
    key: string
  ): Promise<{
    key: string;
    name: string;
    description: string;
    properties: unknown[];
    relations: Array<{ key: string; name: string; targetTypeKey: string; relationType: string }>;
  } | null>;
  query(
    typeKey: string,
    filters?: Record<string, unknown>
  ): Promise<Array<{ id: string; label: string; data: Record<string, unknown>; createdAt: Date }>>;
  get(
    typeKey: string,
    id: string
  ): Promise<{
    id: string;
    label: string;
    data: Record<string, unknown>;
    links: Array<{ relationKey: string; direction: "outgoing" | "incoming"; instanceId: string; label: string }>;
  } | null>;
  create(
    typeKey: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; label: string }>;
  update(
    typeKey: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; label: string }>;
  delete(typeKey: string, id: string): Promise<{ ok: boolean }>;
  link(
    sourceId: string,
    relationKey: string,
    targetId: string,
    metadata?: Record<string, unknown>
  ): Promise<{ id: string }>;
  unlink(
    sourceId: string,
    relationKey: string,
    targetId: string
  ): Promise<{ ok: boolean }>;
  graph(
    typeKey: string,
    id: string,
    options?: { depth?: number }
  ): Promise<{
    nodes: Array<{ id: string; typeKey: string; label: string; data: Record<string, unknown> }>;
    edges: Array<{ sourceId: string; targetId: string; relationKey: string }>;
  }>;
}

export interface ToolContext {
  wiki: {
    get(id: string): Promise<WikiDoc | null>;
    findByPrefix(
      prefix: string
    ): Promise<Array<{ id: string; name: string; meta: Record<string, unknown> | null; content: string }>>;
    search(
      query: string
    ): Promise<Array<{ id: string; name: string; meta: Record<string, unknown> | null; content: string }>>;
  };
  dataset: {
    get(key: string): Promise<unknown>;
  };
  fn: (key: string) => Promise<(...args: unknown[]) => unknown>;
  ontology: OntologyContext;
}

// Module-level promise lock: deduplicates concurrent compilations for the same agentId:versionId.
// First caller triggers the actual compile; subsequent callers await the same promise.
const compilingPromises = new Map<string, Promise<Map<string, unknown>>>();

async function doCompileFunctions(agentId: string, versionId: string): Promise<Map<string, unknown>> {
  const allRows = await getAgentFunctions(agentId, versionId);

  const defsMap = await getDefsMap(agentId);

  const fnRecords: FunctionRecord[] = allRows
    .map((r) => ({
      key: r.key,
      code: r.code,
      parameters: r.parametersSchema ?? {},
    }));

  const { fns, exec } = await resolveAndCompileFunctions(fnRecords, defsMap, ALL_BASE_DEPS);
  setCachedFunctions(agentId, versionId, fns, exec);
  return fns;
}

export function createToolContext(agentId?: string, versionId?: string): ToolContext {
  let resolvedCache: Record<string, unknown> | null = null;
  let compiledFnsPromise: Promise<Map<string, unknown>> | null = null;

  async function getResolved(): Promise<Record<string, unknown>> {
    if (resolvedCache) return resolvedCache;
    if (!agentId || !versionId) return {};

    const rows = await getAgentDatasets(agentId, versionId);

    const { resolvedVars } = resolveDatasets(rows);
    resolvedCache = resolvedVars;
    return resolvedVars;
  }

  async function getCompiledFunctions(): Promise<Map<string, unknown>> {
    if (!agentId || !versionId) return new Map();

    // Check cache first (version-scoped)
    const cached = getCachedFunctions(agentId, versionId);
    if (cached) return cached;

    // Deduplicate concurrent compilations for the same agentId:versionId
    const dedupeKey = `${agentId}:${versionId}`;
    const inflight = compilingPromises.get(dedupeKey);
    if (inflight) return inflight;

    const promise = doCompileFunctions(agentId, versionId);
    compilingPromises.set(dedupeKey, promise);
    try {
      return await promise;
    } finally {
      compilingPromises.delete(dedupeKey);
    }
  }

  return {
    wiki: {
      async get(id: string) {
        if (!versionId) return null;
        // Try by UUID id first (only if it looks like a valid UUID)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let row: { id: string; content: string; agentId: string | null } | undefined;
        if (isUuid) {
          row = await db
            .select({
              id: wikiDocuments.id,
              content: wikiDocuments.content,
              agentId: wikiDocuments.agentId,
            })
            .from(wikiDocuments)
            .where(and(eq(wikiDocuments.id, id), eq(wikiDocuments.versionId, versionId)))
            .limit(1)
            .then((rows) => rows[0]);
        }
        // Fallback: try by key
        if (!row) {
          row = await db
            .select({
              id: wikiDocuments.id,
              content: wikiDocuments.content,
              agentId: wikiDocuments.agentId,
            })
            .from(wikiDocuments)
            .where(
              and(
                eq(wikiDocuments.versionId, versionId),
                eq(wikiDocuments.key, id)
              )
            )
            .limit(1)
            .then((rows) => rows[0]);
        }
        if (!row) return null;
        const { meta, content: body } = parseWikiContent(row.content);
        const hasMeta = Object.keys(meta).length > 0 ? meta : null;
        if (row.agentId) {
          const rendered = await renderWikiContent(row.content, row.agentId, row.id, versionId);
          return { meta: hasMeta, content: rendered };
        }
        return { meta: hasMeta, content: body };
      },

      async findByPrefix(prefix: string) {
        if (!versionId) return [];
        const rows = await db
          .select({
            id: wikiDocuments.id,
            name: wikiDocuments.name,
            content: wikiDocuments.content,
          })
          .from(wikiDocuments)
          .where(and(eq(wikiDocuments.versionId, versionId), like(wikiDocuments.key, `${prefix}%`)));
        return rows.map((r) => {
          const { meta, content } = parseWikiContent(r.content);
          return { id: r.id, name: r.name, meta: Object.keys(meta).length > 0 ? meta : null, content };
        });
      },

      async search(query: string) {
        if (!versionId) return [];
        const rows = await db
          .select({
            id: wikiDocuments.id,
            name: wikiDocuments.name,
            content: wikiDocuments.content,
          })
          .from(wikiDocuments)
          .where(and(eq(wikiDocuments.versionId, versionId), ilike(wikiDocuments.content, `%${query}%`)));
        return rows.map((r) => {
          const { meta, content } = parseWikiContent(r.content);
          return { id: r.id, name: r.name, meta: Object.keys(meta).length > 0 ? meta : null, content };
        });
      },
    },

    dataset: {
      async get(key: string): Promise<unknown> {
        const all = await getResolved();
        return all[key] ?? null;
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

    ontology: createOntologyContext(agentId),
  };
}

/* ═══════════════════════════════════════════════
   Ontology Context Implementation
   ═══════════════════════════════════════════════ */

function createOntologyContext(agentId?: string): OntologyContext {
  // Cache resolved type rows by key
  const typeCache = new Map<
    string,
    {
      id: string;
      key: string;
      name: string;
      description: string;
      schemaId: string | null;
      titleProperty: string | null;
      source: "internal" | "external";
      externalConfig: Record<string, unknown> | null;
    }
  >();

  async function resolveType(key: string) {
    if (typeCache.has(key)) return typeCache.get(key)!;
    if (!agentId) return null;

    const [row] = await db
      .select()
      .from(objectTypes)
      .where(and(eq(objectTypes.agentId, agentId), eq(objectTypes.key, key)));

    if (!row) return null;
    typeCache.set(key, row);
    return row;
  }

  return {
    async types() {
      if (!agentId) return [];
      const rows = await db
        .select({ key: objectTypes.key, name: objectTypes.name, description: objectTypes.description })
        .from(objectTypes)
        .where(eq(objectTypes.agentId, agentId))
        .orderBy(objectTypes.order, objectTypes.key);
      return rows;
    },

    async type(key: string) {
      const t = await resolveType(key);
      if (!t) return null;

      // Fetch schema properties
      let properties: unknown[] = [];
      if (t.schemaId) {
        const [schema] = await db
          .select({ parameters: schemas.parameters })
          .from(schemas)
          .where(eq(schemas.id, t.schemaId));
        if (schema) {
          // Convert JsonSchema7 properties to a list for the ontology API
          const params = schema.parameters as import("@/lib/schemas/types").JsonSchema7;
          if (params.properties) {
            properties = Object.entries(params.properties).map(([key, propSchema]) => ({
              name: key,
              type: typeof propSchema.type === "string" ? propSchema.type : "unknown",
              required: params.required?.includes(key) ?? false,
              description: propSchema.description ?? "",
            }));
          }
        }
      }

      // Fetch relations where this type is source
      const rels = await db
        .select({
          key: objectRelations.key,
          name: objectRelations.name,
          targetTypeId: objectRelations.targetTypeId,
          relationType: objectRelations.relationType,
        })
        .from(objectRelations)
        .where(
          and(
            eq(objectRelations.agentId, agentId!),
            eq(objectRelations.sourceTypeId, t.id)
          )
        );

      // Resolve target type keys
      const targetTypeIds = [...new Set(rels.map((r) => r.targetTypeId))];
      const targetKeyMap = new Map<string, string>();
      if (targetTypeIds.length > 0) {
        const targetRows = await db
          .select({ id: objectTypes.id, key: objectTypes.key })
          .from(objectTypes)
          .where(
            targetTypeIds.length === 1
              ? eq(objectTypes.id, targetTypeIds[0])
              : inArray(objectTypes.id, targetTypeIds)
          );
        for (const r of targetRows) targetKeyMap.set(r.id, r.key);
      }

      return {
        key: t.key,
        name: t.name,
        description: t.description,
        properties,
        relations: rels.map((r) => ({
          key: r.key,
          name: r.name,
          targetTypeKey: targetKeyMap.get(r.targetTypeId) ?? "",
          relationType: r.relationType,
        })),
      };
    },

    async query(typeKey: string, filters?: Record<string, unknown>) {
      const t = await resolveType(typeKey);
      if (!t) return [];

      if (t.source === "external" && t.externalConfig) {
        return (await proxyToExternal(t.externalConfig, "query", filters ?? {})) as Array<{
          id: string;
          label: string;
          data: Record<string, unknown>;
          createdAt: Date;
        }>;
      }

      let query = db
        .select({
          id: objectInstances.id,
          label: objectInstances.label,
          data: objectInstances.data,
          createdAt: objectInstances.createdAt,
        })
        .from(objectInstances)
        .where(
          and(
            eq(objectInstances.agentId, agentId!),
            eq(objectInstances.objectTypeId, t.id)
          )
        )
        .$dynamic();

      // Apply jsonb filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [field, value] of Object.entries(filters)) {
          if (value !== undefined && value !== null) {
            query = query.where(
              sql`${objectInstances.data}->>${sql.raw(`'${field.replace(/'/g, "''")}'`)} = ${String(value)}`
            );
          }
        }
      }

      return query.orderBy(objectInstances.createdAt);
    },

    async get(typeKey: string, id: string) {
      const t = await resolveType(typeKey);
      if (!t) return null;

      if (t.source === "external" && t.externalConfig) {
        return (await proxyToExternal(t.externalConfig, "get", { id })) as {
          id: string;
          label: string;
          data: Record<string, unknown>;
          links: Array<{ relationKey: string; direction: "outgoing" | "incoming"; instanceId: string; label: string }>;
        } | null;
      }

      const [instance] = await db
        .select()
        .from(objectInstances)
        .where(
          and(eq(objectInstances.id, id), eq(objectInstances.objectTypeId, t.id))
        );

      if (!instance) return null;

      // Fetch links (outgoing + incoming)
      const links = await db
        .select()
        .from(objectLinks)
        .where(
          or(eq(objectLinks.sourceId, id), eq(objectLinks.targetId, id))
        );

      // Resolve relation keys + peer instance labels
      const relationIds = [...new Set(links.map((l) => l.relationId))];
      const peerInstanceIds = [
        ...new Set(links.map((l) => (l.sourceId === id ? l.targetId : l.sourceId))),
      ];

      const relationKeyMap = new Map<string, string>();
      if (relationIds.length > 0) {
        const relRows = await db
          .select({ id: objectRelations.id, key: objectRelations.key })
          .from(objectRelations)
          .where(
            relationIds.length === 1
              ? eq(objectRelations.id, relationIds[0])
              : inArray(objectRelations.id, relationIds)
          );
        for (const r of relRows) relationKeyMap.set(r.id, r.key);
      }

      const peerLabelMap = new Map<string, string>();
      if (peerInstanceIds.length > 0) {
        const peerRows = await db
          .select({ id: objectInstances.id, label: objectInstances.label })
          .from(objectInstances)
          .where(
            peerInstanceIds.length === 1
              ? eq(objectInstances.id, peerInstanceIds[0])
              : inArray(objectInstances.id, peerInstanceIds)
          );
        for (const p of peerRows) peerLabelMap.set(p.id, p.label);
      }

      return {
        id: instance.id,
        label: instance.label,
        data: instance.data,
        links: links.map((l) => {
          const isOutgoing = l.sourceId === id;
          const peerId = isOutgoing ? l.targetId : l.sourceId;
          return {
            relationKey: relationKeyMap.get(l.relationId) ?? "",
            direction: (isOutgoing ? "outgoing" : "incoming") as "outgoing" | "incoming",
            instanceId: peerId,
            label: peerLabelMap.get(peerId) ?? "",
          };
        }),
      };
    },

    async create(typeKey: string, data: Record<string, unknown>) {
      const t = await resolveType(typeKey);
      if (!t) throw new Error(`Object type "${typeKey}" not found`);

      if (t.source === "external" && t.externalConfig) {
        return (await proxyToExternal(t.externalConfig, "create", data)) as {
          id: string;
          label: string;
        };
      }

      const label = extractLabel(data, t.titleProperty);

      const [row] = await db
        .insert(objectInstances)
        .values({
          agentId: agentId!,
          objectTypeId: t.id,
          label,
          data,
        })
        .returning({ id: objectInstances.id, label: objectInstances.label });

      return row;
    },

    async update(typeKey: string, id: string, data: Record<string, unknown>) {
      const t = await resolveType(typeKey);
      if (!t) throw new Error(`Object type "${typeKey}" not found`);

      if (t.source === "external" && t.externalConfig) {
        return (await proxyToExternal(t.externalConfig, "update", { id, ...data })) as {
          id: string;
          label: string;
        };
      }

      const [existing] = await db
        .select()
        .from(objectInstances)
        .where(
          and(eq(objectInstances.id, id), eq(objectInstances.objectTypeId, t.id))
        );

      if (!existing) throw new Error(`Instance "${id}" not found`);

      const mergedData = { ...existing.data, ...data };
      const label = extractLabel(mergedData, t.titleProperty);

      const [row] = await db
        .update(objectInstances)
        .set({ data: mergedData, label })
        .where(eq(objectInstances.id, id))
        .returning({ id: objectInstances.id, label: objectInstances.label });

      return row;
    },

    async delete(typeKey: string, id: string) {
      const t = await resolveType(typeKey);
      if (!t) throw new Error(`Object type "${typeKey}" not found`);

      if (t.source === "external" && t.externalConfig) {
        return (await proxyToExternal(t.externalConfig, "delete", { id })) as {
          ok: boolean;
        };
      }

      await db
        .delete(objectInstances)
        .where(
          and(eq(objectInstances.id, id), eq(objectInstances.objectTypeId, t.id))
        );

      return { ok: true };
    },

    async link(sourceId, relationKey, targetId, metadata) {
      if (!agentId) throw new Error("No agentId");

      const [relation] = await db
        .select()
        .from(objectRelations)
        .where(
          and(
            eq(objectRelations.agentId, agentId),
            eq(objectRelations.key, relationKey)
          )
        );

      if (!relation) throw new Error(`Relation "${relationKey}" not found`);

      const [row] = await db
        .insert(objectLinks)
        .values({
          agentId,
          relationId: relation.id,
          sourceId,
          targetId,
          metadata: metadata ?? null,
        })
        .returning({ id: objectLinks.id });

      return row;
    },

    async unlink(sourceId, relationKey, targetId) {
      if (!agentId) throw new Error("No agentId");

      const [relation] = await db
        .select()
        .from(objectRelations)
        .where(
          and(
            eq(objectRelations.agentId, agentId),
            eq(objectRelations.key, relationKey)
          )
        );

      if (!relation) throw new Error(`Relation "${relationKey}" not found`);

      await db
        .delete(objectLinks)
        .where(
          and(
            eq(objectLinks.relationId, relation.id),
            eq(objectLinks.sourceId, sourceId),
            eq(objectLinks.targetId, targetId)
          )
        );

      return { ok: true };
    },

    async graph(typeKey, id, options) {
      const depth = Math.min(options?.depth ?? 2, 5);
      const t = await resolveType(typeKey);
      if (!t) throw new Error(`Object type "${typeKey}" not found`);

      const visited = new Set<string>();
      const nodes: Array<{ id: string; typeKey: string; label: string; data: Record<string, unknown> }> = [];
      const edges: Array<{ sourceId: string; targetId: string; relationKey: string }> = [];

      // Build type id→key map
      const typeIdToKey = new Map<string, string>();
      if (agentId) {
        const allTypes = await db
          .select({ id: objectTypes.id, key: objectTypes.key })
          .from(objectTypes)
          .where(eq(objectTypes.agentId, agentId));
        for (const at of allTypes) typeIdToKey.set(at.id, at.key);
      }

      // BFS
      let frontier = [id];
      for (let d = 0; d <= depth && frontier.length > 0; d++) {
        const newIds = frontier.filter((fid) => !visited.has(fid));
        if (newIds.length === 0) break;
        for (const nid of newIds) visited.add(nid);

        // Fetch instances
        const instanceRows = await db
          .select()
          .from(objectInstances)
          .where(
            newIds.length === 1
              ? eq(objectInstances.id, newIds[0])
              : inArray(objectInstances.id, newIds)
          );

        for (const inst of instanceRows) {
          nodes.push({
            id: inst.id,
            typeKey: typeIdToKey.get(inst.objectTypeId) ?? "",
            label: inst.label,
            data: inst.data,
          });
        }

        if (d === depth) break;

        // Fetch links from/to these instances
        const linkRows = await db
          .select()
          .from(objectLinks)
          .where(
            or(
              newIds.length === 1
                ? eq(objectLinks.sourceId, newIds[0])
                : inArray(objectLinks.sourceId, newIds),
              newIds.length === 1
                ? eq(objectLinks.targetId, newIds[0])
                : inArray(objectLinks.targetId, newIds)
            )
          );

        // Resolve relation keys
        const relIds = [...new Set(linkRows.map((l) => l.relationId))];
        const relKeyMap = new Map<string, string>();
        if (relIds.length > 0) {
          const relRows = await db
            .select({ id: objectRelations.id, key: objectRelations.key })
            .from(objectRelations)
            .where(
              relIds.length === 1
                ? eq(objectRelations.id, relIds[0])
                : inArray(objectRelations.id, relIds)
            );
          for (const r of relRows) relKeyMap.set(r.id, r.key);
        }

        const nextFrontier = new Set<string>();
        for (const link of linkRows) {
          edges.push({
            sourceId: link.sourceId,
            targetId: link.targetId,
            relationKey: relKeyMap.get(link.relationId) ?? "",
          });
          if (!visited.has(link.sourceId)) nextFrontier.add(link.sourceId);
          if (!visited.has(link.targetId)) nextFrontier.add(link.targetId);
        }
        frontier = [...nextFrontier];
      }

      return { nodes, edges };
    },
  };
}
