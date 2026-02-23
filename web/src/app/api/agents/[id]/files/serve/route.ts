import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentFiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [file] = await db
    .select({ url: agentFiles.url })
    .from(agentFiles)
    .where(and(eq(agentFiles.agentId, id), eq(agentFiles.name, name)))
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return NextResponse.redirect(file.url, 302);
}
