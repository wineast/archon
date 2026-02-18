import { db } from "@/db";
import { wikiDocuments, tools } from "@/db/schema";
import type { ToolRow } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { processTemplate } from "@/lib/wiki/template";
import { resolveTitle, stripFrontmatter } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import { getResolvedDatasets } from "@/lib/datasets/queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateData {
  resolvedVars: Record<string, unknown>;
  docs: WikiDocument[];
  toolRows: ToolRow[];
  datasetEntries: Record<string, Array<{ value: string }>>;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getWikiDocs(agentId: string): Promise<WikiDocument[]> {
  const rows = await db
    .select({
      id: wikiDocuments.id,
      content: wikiDocuments.content,
      order: wikiDocuments.order,
      createdAt: wikiDocuments.createdAt,
      updatedAt: wikiDocuments.updatedAt,
    })
    .from(wikiDocuments)
    .where(eq(wikiDocuments.agentId, agentId));

  return rows.map((r) => ({
    ...r,
    title: resolveTitle(r.content),
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
    .where(and(eq(tools.agentId, agentId), eq(tools.enabled, true)));
}

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

// ---------------------------------------------------------------------------
// Internal render (no DB calls)
// ---------------------------------------------------------------------------

async function renderWithData(
  text: string,
  data: TemplateData,
  extraVars: Record<string, unknown> | undefined,
  currentDoc: WikiDocument
): Promise<string> {
  const { ns: toolNs, tool_names, tool_entries } = buildToolNamespace(
    data.toolRows
  );
  const variables: Record<string, unknown> = {
    ...getBuiltinVars(),
    ...data.resolvedVars,
    ...extraVars,
    tool: toolNs,
    tool_names,
    tool_entries,
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
    return { resolvedVars: {}, docs: [], toolRows: [], datasetEntries: {} };
  }

  const [{ resolvedVars, datasetEntries }, docs, toolRows] = await Promise.all([
    getResolvedDatasets(agentId),
    getWikiDocs(agentId),
    getEnabledTools(agentId),
  ]);

  return { resolvedVars, docs, toolRows, datasetEntries };
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
