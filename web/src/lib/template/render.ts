import { db } from "@/db";
import { wikiDocuments, tools, schemas, objectTypes, objectRelations } from "@/db/schema";
import type { ToolRow } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { JsonSchema7 } from "@/lib/schemas/types";
import { resolveInlineSchema } from "@/lib/schemas/resolve-inline";
import { processTemplate } from "@/lib/wiki/template";
import { stripFrontmatter } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import { getResolvedDatasets } from "@/lib/datasets/queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OntologyTypeTemplateItem {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  properties: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  relations: Array<{
    key: string;
    name: string;
    targetKey: string;
    targetName: string;
    relationType: string;
    inverseName: string;
  }>;
}

export interface TemplateData {
  resolvedVars: Record<string, unknown>;
  docs: WikiDocument[];
  toolRows: ToolRow[];
  /** Schema lookup by key: key → parameters. Used for $ref resolution in buildInputSchema. */
  defsMap: Record<string, JsonSchema7>;
  datasetEntries: Record<string, Array<{ value: string }>>;
  ontologyTypes: OntologyTypeTemplateItem[];
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getWikiDocs(agentId: string): Promise<WikiDocument[]> {
  const rows = await db
    .select({
      id: wikiDocuments.id,
      parentId: wikiDocuments.parentId,
      name: wikiDocuments.name,
      key: wikiDocuments.key,
      content: wikiDocuments.content,
      order: wikiDocuments.order,
      createdAt: wikiDocuments.createdAt,
      updatedAt: wikiDocuments.updatedAt,
    })
    .from(wikiDocuments)
    .where(and(eq(wikiDocuments.agentId, agentId), isNull(wikiDocuments.deletedAt)));

  return rows.map((r) => ({
    ...r,
    name: r.name,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));
}

// ---------------------------------------------------------------------------
// Built-in variables
// ---------------------------------------------------------------------------

function getBuiltinVars(): Record<string, string> {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8),
    datetime: now.toISOString(),
    timestamp: String(now.getTime()),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
  };
}

// ---------------------------------------------------------------------------
// Tool namespace
// ---------------------------------------------------------------------------

async function getEnabledTools(agentId: string): Promise<ToolRow[]> {
  return db
    .select()
    .from(tools)
    .where(and(eq(tools.agentId, agentId), eq(tools.enabled, true), isNull(tools.deletedAt)));
}

export function buildToolNamespace(
  toolRows: ToolRow[],
  defsMap: Record<string, JsonSchema7> = {}
): {
  ns: Record<string, unknown>;
  tool_entries: Array<{
    name: string;
    description: string;
    parameters: Array<{ name: string; type: string; description: string; required: boolean; enum?: unknown[] }>;
  }>;
} {
  const ns: Record<string, unknown> = {};
  const entries: Array<{
    name: string;
    description: string;
    parameters: Array<{ name: string; type: string; description: string; required: boolean; enum?: unknown[] }>;
  }> = [];

  for (const row of toolRows) {
    const schema: JsonSchema7 = resolveInlineSchema(row.parametersSchema ?? null, defsMap)
      ?? { type: "object", properties: {}, required: [] };
    const props = schema.properties ?? {};
    const requiredSet = new Set(schema.required ?? []);

    const parameters = Object.entries(props).map(([key, propSchema]) => ({
      name: key,
      type: (typeof propSchema.type === "string" ? propSchema.type : "unknown") as string,
      description: propSchema.description ?? "",
      required: requiredSet.has(key),
      ...(propSchema.enum ? { enum: propSchema.enum } : {}),
    }));

    ns[row.name] = {
      name: row.name,
      description: row.description,
      parameters,
    };

    entries.push({
      name: row.name,
      description: row.description,
      parameters,
    });
  }

  return {
    ns,
    tool_entries: entries,
  };
}

// ---------------------------------------------------------------------------
// Internal render (no DB calls)
// ---------------------------------------------------------------------------

async function renderWithData(
  text: string,
  data: TemplateData,
  extraVars: Record<string, unknown> | undefined,
  currentDoc: WikiDocument
): Promise<string> {
  const { ns: toolNs, tool_entries } = buildToolNamespace(
    data.toolRows,
    data.defsMap
  );
  const variables: Record<string, unknown> = {
    ...getBuiltinVars(),
    ...data.resolvedVars,
    ...extraVars,
    tool: toolNs,
    tool_entries,
    ontology_types: data.ontologyTypes,
    ontology: Object.fromEntries(
      data.ontologyTypes.map((t) => [t.key, t])
    ),
  };

  return processTemplate(text, {
    documents: data.docs,
    currentDoc,
    variables,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Gather all template-related data from DB (once).
 * Use with `renderTemplate()` when rendering multiple templates with the
 * same data (e.g. eval loop) to avoid redundant DB queries.
 */
export async function gatherTemplateData(
  agentId?: string
): Promise<TemplateData> {
  if (!agentId) {
    return { resolvedVars: {}, docs: [], toolRows: [], defsMap: {}, datasetEntries: {}, ontologyTypes: [] };
  }

  const [{ resolvedVars, datasetEntries }, docs, toolRows, objTypeRows, objRelRows] = await Promise.all([
    getResolvedDatasets(agentId),
    getWikiDocs(agentId),
    getEnabledTools(agentId),
    db.select().from(objectTypes).where(and(eq(objectTypes.agentId, agentId), isNull(objectTypes.deletedAt))).orderBy(objectTypes.order),
    db.select().from(objectRelations).where(and(eq(objectRelations.agentId, agentId), isNull(objectRelations.deletedAt))),
  ]);

  // Load ALL schemas for this agent — build defsMap (key → parameters) for $ref resolution
  // and a local id-based map for ontology type schema lookups
  const allSchemaRows = await db
    .select()
    .from(schemas)
    .where(and(eq(schemas.agentId, agentId), isNull(schemas.deletedAt)));

  const defsMap: Record<string, JsonSchema7> = {};
  const schemaByIdMap: Record<string, JsonSchema7> = {};
  for (const row of allSchemaRows) {
    defsMap[row.key] = row.parameters as JsonSchema7;
    schemaByIdMap[row.id] = row.parameters as JsonSchema7;
  }

  // Build ontology template items
  const objTypeIdToRow = new Map(objTypeRows.map((t) => [t.id, t]));
  const ontologyTypes: OntologyTypeTemplateItem[] = objTypeRows.map((t) => {
    // Resolve properties from linked schema
    const linkedSchema = t.schemaId ? schemaByIdMap[t.schemaId] : undefined;
    const properties: OntologyTypeTemplateItem["properties"] = linkedSchema?.properties
      ? Object.entries(linkedSchema.properties).map(([key, propSchema]) => ({
          name: key,
          type: (typeof propSchema.type === "string" ? propSchema.type : "unknown") as string,
          required: linkedSchema.required?.includes(key) ?? false,
          description: propSchema.description ?? "",
        }))
      : [];

    // Find relations where this type is source
    const relations: OntologyTypeTemplateItem["relations"] = objRelRows
      .filter((r) => r.sourceTypeId === t.id)
      .map((r) => {
        const target = objTypeIdToRow.get(r.targetTypeId);
        return {
          key: r.key,
          name: r.name,
          targetKey: target?.key ?? "",
          targetName: target?.name ?? "",
          relationType: r.relationType,
          inverseName: r.inverseName,
        };
      });

    return {
      key: t.key,
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      properties,
      relations,
    };
  });

  return { resolvedVars, docs, toolRows, defsMap, datasetEntries, ontologyTypes };
}

/**
 * Render a template string with pre-gathered data.
 * Does NOT hit DB — suitable for use inside loops.
 */
export async function renderTemplate(
  text: string,
  data: TemplateData,
  extraVars?: Record<string, unknown>
): Promise<string> {
  if (!text) return text;

  try {
    const virtualDoc: WikiDocument = {
      id: "__system_prompt__",
      parentId: null,
      key: "",
      name: "System Prompt",
      content: text,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return await renderWithData(text, data, extraVars, virtualDoc);
  } catch (e) {
    console.error("[renderTemplate] template rendering failed:", e);
    return text;
  }
}

/**
 * Render a system prompt through the full template pipeline.
 * Convenience wrapper: gathers data from DB + renders.
 */
export async function renderSystemPrompt(
  systemPrompt: string,
  agentId?: string,
  extraVars?: Record<string, unknown>
): Promise<string> {
  if (!systemPrompt) return systemPrompt;

  try {
    const data = await gatherTemplateData(agentId);
    return await renderTemplate(systemPrompt, data, extraVars);
  } catch (e) {
    console.error("[renderSystemPrompt] template rendering failed:", e);
    return systemPrompt;
  }
}

/**
 * Render wiki document content through the same template pipeline.
 * Uses the real wiki document as currentDoc (for {{documentTitle}} etc).
 */
export async function renderWikiContent(
  content: string,
  agentId: string,
  currentDocId: string
): Promise<string> {
  if (!content) return content;

  try {
    const data = await gatherTemplateData(agentId);
    const strippedContent = stripFrontmatter(content);

    const currentDoc = data.docs.find((d) => d.id === currentDocId) ?? {
      id: currentDocId,
      parentId: null,
      key: "",
      name: "Unknown",
      content: strippedContent,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return await renderWithData(strippedContent, data, undefined, currentDoc);
  } catch (e) {
    console.error("[renderWikiContent] template rendering failed:", e);
    return content;
  }
}
