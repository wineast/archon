import { NextResponse, type NextRequest } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireAgentRole(id, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json({
    role: ctx.role,
    isSuperAdmin: ctx.isSuperAdmin,
  });
}
