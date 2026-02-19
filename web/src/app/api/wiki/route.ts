import { NextResponse } from "next/server";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { resolveTitle } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import type { WikiDocumentRow } from "@/db/schema";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

function toWikiDocument(row: WikiDocumentRow): WikiDocument {
  return {
    id: row.id,
    key: row.key,
    title: row.title || resolveTitle(row.content),
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
    .where(and(eq(wikiDocuments.agentId, agentId), isNull(wikiDocuments.deletedAt)));
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

  if (!body.title || !body.key) {
    return NextResponse.json(
      { error: "title and key are required" },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(wikiDocuments)
    .values({
      agentId,
      title: body.title,
      key: body.key,
      content: body.content,
      order: body.order,
    })
    .returning();
  return NextResponse.json(toWikiDocument(row), { status: 201 });
}
