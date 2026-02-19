import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { agentFiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(agentFiles)
    .where(eq(agentFiles.agentId, id))
    .orderBy(desc(agentFiles.createdAt));

  return NextResponse.json(rows);
}

const ALLOWED_TYPES = ["application/pdf"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await requireAgentRole(id, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 20 MB)" },
      { status: 400 }
    );
  }

  const blob = await put(`agents/${id}/${file.name}`, file, {
    access: "public",
    contentType: file.type,
  });

  const [row] = await db
    .insert(agentFiles)
    .values({
      agentId: id,
      name: file.name,
      url: blob.url,
      size: file.size,
      contentType: file.type,
    })
    .onConflictDoUpdate({
      target: [agentFiles.agentId, agentFiles.name],
      set: {
        url: blob.url,
        size: file.size,
        contentType: file.type,
      },
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
