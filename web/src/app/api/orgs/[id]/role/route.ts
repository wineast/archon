import { NextResponse, type NextRequest } from "next/server";
import { requireOrgRole } from "@/lib/auth/require-org-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requireOrgRole(id, "member");
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json({
    role: ctx.role,
    isSuperAdmin: ctx.isSuperAdmin,
  });
}
