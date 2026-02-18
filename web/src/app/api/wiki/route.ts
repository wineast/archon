import { NextResponse } from "next/server";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseWikiContent } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import type { WikiDocumentRow } from "@/db/schema";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

function toWikiDocument(row: WikiDocumentRow): WikiDocument {
  const { meta, content: body } = parseWikiContent(row.content);
  return {
    id: row.id,
    title: meta.title || body.split("\n")[0]?.trim() || row.title,
    content: row.content,
    order: row.order,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(wikiDocuments)
    .where(eq(wikiDocuments.agentId, agentId));
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

  const [row] = await db
    .insert(wikiDocuments)
    .values({
      id: body.id,
      agentId,
      title: body.title,
      content: body.content,
      order: body.order,
    })
    .returning();
  return NextResponse.json(toWikiDocument(row), { status: 201 });
}
