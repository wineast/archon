import { NextRequest, NextResponse } from "next/server";
import { cleanupDeletedUsers } from "@/lib/auth/account-deletion";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupDeletedUsers();

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
