import { NextResponse } from "next/server";
import { db } from "@/db";
import { wikiDocuments } from "@/db/schema";
import { resolveTitle } from "@/lib/wiki/frontmatter";
import type { WikiDocument } from "@/lib/wiki/types";
import type { WikiDocumentRow } from "@/db/schema";

function toWikiDocument(row: WikiDocumentRow): WikiDocument {
  return {
    id: row.id,
    title: resolveTitle(row.content),
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
      content: body.content,
      order: body.order,
    })
    .returning();
  return NextResponse.json(toWikiDocument(row), { status: 201 });
}
