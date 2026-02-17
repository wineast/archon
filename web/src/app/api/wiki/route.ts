import { NextResponse } from "next/server";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";
import { parseWikiContent } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import type { WikiDocumentRow } from "@/db/schema";

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

export async function GET() {
  const rows = await db.select().from(wikiDocuments);
  return NextResponse.json(rows.map(toWikiDocument));
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db
    .insert(wikiDocuments)
    .values({
      id: body.id,
      title: body.title,
      content: body.content,
      order: body.order,
    })
    .returning();
  return NextResponse.json(toWikiDocument(row), { status: 201 });
}
