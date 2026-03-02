import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/singletons";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const decoded = decodeURIComponent(sessionId);
  const { termManager } = await getAdmin();
  const exists = termManager.verify(decoded);
  return NextResponse.json({ exists, sessionId: decoded });
}
