import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentFiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const [result] = await db
    .select({
      totalSize: sql<number>`coalesce(sum(${agentFiles.size}), 0)`,
      fileCount: sql<number>`count(*)`,
    })
    .from(agentFiles)
    .where(eq(agentFiles.agentId, agentId));

  return Response.json(result);
}
