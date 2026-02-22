import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";
import { resolveName } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import type { WikiDocumentRow } from "@/db/schema";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { logAudit } from "@/lib/audit/log";
import { getAgentResources, type WithPoolMeta } from "@/lib/pool/queries";
import { resolveEditingVersionId } from "@/lib/versions/resolve";

function toWikiDocument(row: WithPoolMeta<WikiDocumentRow>): WithPoolMeta<WikiDocument>;
function toWikiDocument(row: WikiDocumentRow): WikiDocument;
function toWikiDocument(row: WikiDocumentRow & { _source?: string; _refId?: string; _refEnabled?: boolean }) {
  const base: WikiDocument = {
    id: row.id,
    parentId: row.parentId,
    key: row.key,
    name: row.name || resolveName(row.content),
    content: row.content,
    order: row.order,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
  if ("_source" in row && row._source) {
    return { ...base, _source: row._source, _refId: row._refId, _refEnabled: row._refEnabled };
  }
  return base;
}

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = await resolveEditingVersionId(agentId);
  const rows = await getAgentResources<WikiDocumentRow>(agentId, "wiki", versionId);
  return NextResponse.json(rows.map(toWikiDocument));
}

export async function POST(req: Request) {
  const body = await req.json();
  const agentId = body.agentId;
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = await resolveEditingVersionId(agentId);

  if (!body.name || !body.key) {
    return NextResponse.json(
      { error: "name and key are required" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(wikiDocuments)
    .values({
      agentId,
      versionId,
      parentId: body.parentId ?? null,
      name: body.name,
      key: body.key,
      content: body.content,
      order: body.order,
    })
    .returning();
  after(async () => {
    await logAudit({
      agentId,
      userId: ctx.user.id,
      action: "created",
      resourceType: "wiki",
      resourceId: row.id,
      resourceKey: row.key,
      resourceName: row.name,
    });
  });

  return NextResponse.json(toWikiDocument(row), { status: 201 });
}
