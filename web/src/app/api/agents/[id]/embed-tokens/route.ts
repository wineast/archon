import { NextResponse } from "next/server";
import { db } from "@/db";
import { embedTokens } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { nanoid } from "nanoid";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select()
    .from(embedTokens)
    .where(eq(embedTokens.agentId, agentId))
    .orderBy(desc(embedTokens.createdAt));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "editor");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const name = (body.name as string)?.trim();
  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const allowedOrigins: string[] = Array.isArray(body.allowedOrigins)
    ? body.allowedOrigins.filter((o: unknown) => typeof o === "string" && o)
    : [];

  const token = `et_${nanoid(32)}`;

  const [row] = await db
    .insert(embedTokens)
    .values({ agentId, name, token, allowedOrigins })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
