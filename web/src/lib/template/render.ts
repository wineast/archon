import { Liquid } from "liquidjs";
import { db } from "@/db";
import {
  wikiDocuments,
  lookupTables,
  lookupEntries,
  dataObjects,
  tools,
} from "@/db/schema";
import type { ToolRow } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { processTemplate } from "@/lib/wiki/template";
import { stripFrontmatter } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import { getTemplateVars } from "@/lib/template-vars/queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LookupEntryArray = Array<{
  value: string;
  label: string | null;
  metadata: Record<string, unknown> | null;
}>;

interface LookupTableInfo {
  entries: LookupEntryArray;
}

interface DataObjectInfo {
  data: Record<string, unknown>;
}

export interface TemplateData {
  activeVars: Record<string, unknown>;
  docs: WikiDocument[];
  lookupVars: Record<string, LookupTableInfo>;
  dataObjectVars: Record<string, DataObjectInfo>;
  toolRows: ToolRow[];
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getWikiDocs(agentId: string): Promise<WikiDocument[]> {
  const rows = await db
    .select({
      id: wikiDocuments.id,
      title: wikiDocuments.title,
      content: wikiDocuments.content,
      order: wikiDocuments.order,
      createdAt: wikiDocuments.createdAt,
      updatedAt: wikiDocuments.updatedAt,
    })
    .from(wikiDocuments)
    .where(eq(wikiDocuments.agentId, agentId));

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  }));
}

async function getLookupVars(
  agentId: string
): Promise<Record<string, LookupTableInfo>> {
  const tables = await db
    .select({
      id: lookupTables.id,
      key: lookupTables.key,
    })
    .from(lookupTables)
    .where(eq(lookupTables.agentId, agentId));

  if (tables.length === 0) return {};

  const result: Record<string, LookupTableInfo> = {};

  await Promise.all(
    tables.map(async (table) => {
      const entries = await db
        .select({
          value: lookupEntries.value,
          label: lookupEntries.label,
          metadata: lookupEntries.metadata,
        })
        .from(lookupEntries)
        .where(eq(lookupEntries.tableId, table.id))
        .orderBy(lookupEntries.order);

      result[table.key] = {
        entries: entries as LookupEntryArray,
      };
    })
  );

  return result;
}

async function getDataObjectVars(
  agentId: string
): Promise<Record<string, DataObjectInfo>> {
  const objects = await db
    .select({
      key: dataObjects.key,
      data: dataObjects.data,
    })
    .from(dataObjects)
    .where(eq(dataObjects.agentId, agentId));

  if (objects.length === 0) return {};

  const result: Record<string, DataObjectInfo> = {};
  for (const obj of objects) {
    result[obj.key] = {
      data: obj.data as Record<string, unknown>,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Built-in variables (same as lib/template.ts getBuiltinVars)
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
// Internal render (no DB calls)
// ---------------------------------------------------------------------------

/**
 * Build a namespaced lookup object so templates access lookup tables via `lookup.*`.
 * For each key (e.g. "income_type"), produces:
 *   lookup.income_type         → comma-joined values
 *   lookup.income_type_label   → comma-joined labels
 *   lookup.income_type_json    → JSON string
 *   lookup.income_type_entries → raw array for {% for %}
 */
/** Shared Liquid instance for simple variable substitution (no custom tags). */
const simpleLiquid = new Liquid({ jsTruthy: true });

/**
 * Render a LiquidJS expression in a lookup entry value/label.
 * Only does simple variable substitution; falls back to the original string on error.
 */
export function renderEntryField(
  raw: string,
  vars: Record<string, unknown>
): string {
  try {
    return simpleLiquid.parseAndRenderSync(raw, vars);
  } catch {
    return raw;
  }
}

/**
 * Render LiquidJS expressions inside a metadata object.
 * Serialises to JSON string, runs LiquidJS, then parses back.
 */
export function renderMetadataField(
  raw: Record<string, unknown>,
  vars: Record<string, unknown>
): Record<string, unknown> {
  try {
    const rendered = renderEntryField(JSON.stringify(raw), vars);
    return JSON.parse(rendered);
  } catch {
    return raw;
  }
}

function buildLookupNamespace(
  lookupVars: Record<string, LookupTableInfo>,
  activeVars?: Record<string, unknown>
): Record<string, unknown> {
  const ns: Record<string, unknown> = {};

  for (const [key, info] of Object.entries(lookupVars)) {
    const entries = info.entries;
    if (!entries.length) continue;

    // If activeVars provided, resolve LiquidJS expressions in value/label/metadata
    const resolved = activeVars
      ? entries.map((e) => ({
          ...e,
          value: renderEntryField(e.value, activeVars),
          label: e.label ? renderEntryField(e.label, activeVars) : e.label,
          metadata: e.metadata
            ? renderMetadataField(e.metadata, activeVars)
            : e.metadata,
        }))
      : entries;

    ns[key] = resolved.map((e) => e.value).join(", ");
    ns[`${key}_label`] = resolved
      .map((e) => e.label || e.value)
      .join(", ");
    ns[`${key}_json`] = JSON.stringify(resolved);
    ns[`${key}_entries`] = resolved;
  }

  return ns;
}

/**
 * Build a namespaced data object so templates access data objects via `data.*`.
 * For each key (e.g. "product_routes"), produces:
 *   data.product_routes          → rendered object
 *   data.product_routes_json     → JSON string
 *   data.product_routes_entries  → virtual entry array for {% for %}
 */
function buildDataNamespace(
  dataObjectVars: Record<string, DataObjectInfo>,
  activeVars?: Record<string, unknown>
): Record<string, unknown> {
  const ns: Record<string, unknown> = {};

  for (const [key, info] of Object.entries(dataObjectVars)) {
    const rendered = activeVars
      ? renderMetadataField(info.data, activeVars)
      : info.data;
    ns[key] = rendered;
    ns[`${key}_json`] = JSON.stringify(rendered);
    ns[`${key}_entries`] = Object.entries(rendered).map(([k, v]) => ({
      value: k,
      label:
        (v as Record<string, unknown>)?.label as string | null ?? null,
      metadata: v as Record<string, unknown>,
    }));
  }

  return ns;
}

// ---------------------------------------------------------------------------
// Tool namespace
// ---------------------------------------------------------------------------

async function getEnabledTools(agentId: string): Promise<ToolRow[]> {
  return db
    .select()
    .from(tools)
    .where(and(eq(tools.agentId, agentId), eq(tools.enabled, true)));
}

/**
 * Build a namespaced tool object so templates access data via `tool.*`.
 * For each tool (e.g. "route_loan_products"), produces a nested object:
 *   tool.route_loan_products.name        → name
 *   tool.route_loan_products.description → description
 *   tool.route_loan_products.params      → comma-joined parameter names
 *   tool.route_loan_products.parameters  → array of {name, type, description, required, enum?}
 *   tool.route_loan_products.json        → JSON string {name, description, parameters}
 *
 * Also produces top-level:
 *   tool_names   → comma-joined enabled tool names
 *   tool_entries → array for {% for t in tool_entries %}
 */
export function buildToolNamespace(toolRows: ToolRow[]): {
  ns: Record<string, unknown>;
  tool_names: string;
  tool_entries: Array<{
    name: string;
    description: string;
    params: Array<{ name: string; type: string }>;
  }>;
} {
  const ns: Record<string, unknown> = {};
  const names: string[] = [];
  const entries: Array<{
    name: string;
    description: string;
    params: Array<{ name: string; type: string }>;
  }> = [];

  for (const row of toolRows) {
    const rawParams = row.parameters ?? [];
    const simpleParams = rawParams.map((p) => ({
      name: p.name,
      type: p.type,
    }));

    ns[row.name] = {
      name: row.name,
      description: row.description,
      params: rawParams.map((p) => p.name).join(", "),
      parameters: rawParams.map((p) => ({
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required,
        ...(p.enum ? { enum: p.enum } : {}),
      })),
      json: JSON.stringify({
        name: row.name,
        description: row.description,
        parameters: rawParams,
      }),
    };

    names.push(row.name);
    entries.push({
      name: row.name,
      description: row.description,
      params: simpleParams,
    });
  }

  return {
    ns,
    tool_names: names.join(", "),
    tool_entries: entries,
  };
}

async function renderWithData(
  text: string,
  data: TemplateData,
  extraVars: Record<string, unknown> | undefined,
  currentDoc: WikiDocument
): Promise<string> {
  // Merge variables: builtins < active vars < extraVars; lookup & tool in own namespaces
  const mergedVars: Record<string, unknown> = {
    ...getBuiltinVars(),
    ...data.activeVars,
    ...extraVars,
  };
  const { ns: toolNs, tool_names, tool_entries } = buildToolNamespace(
    data.toolRows
  );
  const variables: Record<string, unknown> = {
    ...mergedVars,
    lookup: buildLookupNamespace(data.lookupVars, mergedVars),
    data: buildDataNamespace(data.dataObjectVars, mergedVars),
    tool: toolNs,
    tool_names,
    tool_entries,
  };

  // Render via LiquidJS (handles {{var}}, {% include %}, {{lookup.*}}, {% if %} etc)
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
  const activeVars = agentId ? await getTemplateVars(agentId) : {};
  const docs = agentId ? await getWikiDocs(agentId) : [];
  const lookupVars = agentId ? await getLookupVars(agentId) : {};
  const dataObjectVars = agentId ? await getDataObjectVars(agentId) : {};
  const toolRows = agentId ? await getEnabledTools(agentId) : [];
  return { activeVars, docs, lookupVars, dataObjectVars, toolRows };
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
      title: "System Prompt",
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

    // Strip frontmatter before rendering
    const strippedContent = stripFrontmatter(content);

    const currentDoc = data.docs.find((d) => d.id === currentDocId) ?? {
      id: currentDocId,
      title: "Unknown",
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
