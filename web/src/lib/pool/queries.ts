import { db } from "@/db";
import {
  tools,
  components,
  functions,
  datasets,
  wikiDocuments,
  schemas,
  mcpServers,
  agentResourceRefs,
} from "@/db/schema";
import type {
  ToolRow,
  ComponentRow,
  FunctionRow,
  DatasetRow,
  WikiDocumentRow,
  SchemaRow,
  McpServerRow,
  ResourceType,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Source annotation
// ---------------------------------------------------------------------------

export type ResourceSource = "private" | "pool";

export type WithPoolMeta<T> = T & {
  _source: ResourceSource;
  _refId?: string;
  _refEnabled?: boolean;
};

// ---------------------------------------------------------------------------
// Table + column references map
// ---------------------------------------------------------------------------

interface TableMeta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: PgTableWithColumns<any>;
  resourceType: ResourceType;
}

const TABLE_META: Record<ResourceType, TableMeta> = {
  tool:          { table: tools, resourceType: "tool" },
  component:     { table: components, resourceType: "component" },
  function:      { table: functions, resourceType: "function" },
  dataset:       { table: datasets, resourceType: "dataset" },
  wiki:          { table: wikiDocuments, resourceType: "wiki" },
  schema:        { table: schemas, resourceType: "schema" },
  "mcp-server":  { table: mcpServers, resourceType: "mcp-server" },
};

// ---------------------------------------------------------------------------
// Generic: get agent resources (private + pool refs)
// ---------------------------------------------------------------------------

/**
 * Get all resources for a version: both private (versionId = versionId) and
 * pool references (via agentResourceRefs).
 */
export async function getAgentResources<T extends { id: string }>(
  agentId: string,
  resourceType: ResourceType,
  versionId: string,
): Promise<WithPoolMeta<T>[]> {
  const { table } = TABLE_META[resourceType];

  // 1. Private resources (owned by this version)
  const privateRows = await db
    .select()
    .from(table)
    .where(and(eq(table.versionId, versionId), isNull(table.deletedAt))) as T[];

  // 2. Pool resources referenced by this version
  const poolRows = await db
    .select({
      resource: table,
      refId: agentResourceRefs.id,
      refEnabled: agentResourceRefs.enabled,
    })
    .from(agentResourceRefs)
    .innerJoin(table, eq(table.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, resourceType),
        isNull(table.agentId),
        isNull(table.deletedAt),
      )
    ) as Array<{ resource: T; refId: string; refEnabled: boolean }>;

  const result: WithPoolMeta<T>[] = [
    ...privateRows.map((r) => ({ ...r, _source: "private" as const })),
    ...poolRows.map(({ resource, refId, refEnabled }) => ({
      ...resource,
      _source: "pool" as const,
      _refId: refId,
      _refEnabled: refEnabled,
    })),
  ];

  return result;
}

// ---------------------------------------------------------------------------
// Tool-specific helpers
// ---------------------------------------------------------------------------

/**
 * Get all tools for a version (private + pool refs), with source metadata.
 */
export async function getAgentTools(
  agentId: string,
  versionId: string,
): Promise<WithPoolMeta<ToolRow>[]> {
  return getAgentResources<ToolRow>(agentId, "tool", versionId);
}

/**
 * Get all enabled tools for a version (runtime use).
 * Private tools: enabled=true. Pool refs: ref.enabled=true AND tool.enabled=true.
 */
export async function getAgentEnabledTools(
  agentId: string,
  versionId: string,
): Promise<ToolRow[]> {
  // 1. Private enabled tools
  const privateRows = await db
    .select()
    .from(tools)
    .where(
      and(
        eq(tools.versionId, versionId),
        eq(tools.enabled, true),
        isNull(tools.deletedAt),
      )
    );

  // 2. Pool enabled tools (ref enabled AND tool enabled)
  const poolRows = await db
    .select({ resource: tools })
    .from(agentResourceRefs)
    .innerJoin(tools, eq(tools.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, "tool"),
        eq(agentResourceRefs.enabled, true),
        isNull(tools.agentId),
        eq(tools.enabled, true),
        isNull(tools.deletedAt),
      )
    );

  return [...privateRows, ...poolRows.map((r) => r.resource)];
}

// ---------------------------------------------------------------------------
// MCP server helpers
// ---------------------------------------------------------------------------

/**
 * Get all enabled MCP servers for a version (private + pool refs).
 */
export async function getAgentEnabledMcpServers(
  agentId: string,
  versionId: string,
): Promise<McpServerRow[]> {
  const privateRows = await db
    .select()
    .from(mcpServers)
    .where(
      and(
        eq(mcpServers.versionId, versionId),
        eq(mcpServers.enabled, true),
        isNull(mcpServers.deletedAt),
      )
    );

  const poolRows = await db
    .select({ resource: mcpServers })
    .from(agentResourceRefs)
    .innerJoin(mcpServers, eq(mcpServers.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, "mcp-server"),
        eq(agentResourceRefs.enabled, true),
        isNull(mcpServers.agentId),
        eq(mcpServers.enabled, true),
        isNull(mcpServers.deletedAt),
      )
    );

  return [...privateRows, ...poolRows.map((r) => r.resource)];
}

// ---------------------------------------------------------------------------
// Dataset helpers
// ---------------------------------------------------------------------------

/**
 * Get all datasets for a version (private + pool refs) — lightweight fields only.
 */
export async function getAgentDatasets(
  agentId: string,
  versionId: string,
): Promise<Array<{ key: string; name: string; data: unknown }>> {
  const privateRows = await db
    .select({ key: datasets.key, name: datasets.name, data: datasets.data })
    .from(datasets)
    .where(and(eq(datasets.versionId, versionId), isNull(datasets.deletedAt)));

  const poolRows = await db
    .select({
      key: datasets.key,
      name: datasets.name,
      data: datasets.data,
    })
    .from(agentResourceRefs)
    .innerJoin(datasets, eq(datasets.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, "dataset"),
        isNull(datasets.agentId),
        isNull(datasets.deletedAt),
      )
    );

  return [...privateRows, ...poolRows];
}

// ---------------------------------------------------------------------------
// Wiki helpers
// ---------------------------------------------------------------------------

/**
 * Get all wiki documents for a version (private + pool refs).
 */
export async function getAgentWikiDocs(
  agentId: string,
  versionId: string,
) {
  const cols = {
    id: wikiDocuments.id,
    parentId: wikiDocuments.parentId,
    name: wikiDocuments.name,
    key: wikiDocuments.key,
    content: wikiDocuments.content,
    order: wikiDocuments.order,
    createdAt: wikiDocuments.createdAt,
    updatedAt: wikiDocuments.updatedAt,
  };

  const privateRows = await db
    .select(cols)
    .from(wikiDocuments)
    .where(and(eq(wikiDocuments.versionId, versionId), isNull(wikiDocuments.deletedAt)));

  const poolRows = await db
    .select(cols)
    .from(agentResourceRefs)
    .innerJoin(wikiDocuments, eq(wikiDocuments.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, "wiki"),
        isNull(wikiDocuments.agentId),
        isNull(wikiDocuments.deletedAt),
      )
    );

  return [...privateRows, ...poolRows];
}

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

/**
 * Get all schemas for a version (private + pool refs).
 */
export async function getAgentSchemas(
  agentId: string,
  versionId: string,
): Promise<SchemaRow[]> {
  const privateRows = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.versionId, versionId), isNull(schemas.deletedAt)));

  const poolRows = await db
    .select({ resource: schemas })
    .from(agentResourceRefs)
    .innerJoin(schemas, eq(schemas.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, "schema"),
        isNull(schemas.agentId),
        isNull(schemas.deletedAt),
      )
    );

  return [...privateRows, ...poolRows.map((r) => r.resource)];
}

// ---------------------------------------------------------------------------
// Function helpers
// ---------------------------------------------------------------------------

/**
 * Get all functions for a version (private + pool refs) — lightweight fields for sandbox.
 */
export async function getAgentFunctions(
  agentId: string,
  versionId: string,
): Promise<Array<{ key: string; code: string; parametersSchema: unknown }>> {
  const privateRows = await db
    .select({ key: functions.key, code: functions.code, parametersSchema: functions.parametersSchema })
    .from(functions)
    .where(and(eq(functions.versionId, versionId), isNull(functions.deletedAt)));

  const poolRows = await db
    .select({
      key: functions.key,
      code: functions.code,
      parametersSchema: functions.parametersSchema,
    })
    .from(agentResourceRefs)
    .innerJoin(functions, eq(functions.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.versionId, versionId),
        eq(agentResourceRefs.resourceType, "function"),
        isNull(functions.agentId),
        isNull(functions.deletedAt),
      )
    );

  return [...privateRows, ...poolRows];
}

// ---------------------------------------------------------------------------
// Builtin function helpers
// ---------------------------------------------------------------------------

/**
 * Get the set of builtin function keys referenced by an agent.
 * Functions don't use the enabled field on refs (reserved for tools).
 * If a ref exists, the builtin dependency is available.
 */
export async function getReferencedBuiltinFunctionKeys(
  agentId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ key: functions.key })
    .from(agentResourceRefs)
    .innerJoin(functions, eq(functions.id, agentResourceRefs.resourceId))
    .where(
      and(
        eq(agentResourceRefs.agentId, agentId),
        eq(agentResourceRefs.resourceType, "function"),
        isNull(functions.agentId),
        eq(functions.origin, "builtin"),
      )
    );

  return new Set(rows.map((r) => r.key));
}

