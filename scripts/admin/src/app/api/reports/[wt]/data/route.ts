import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAdmin } from "@/lib/singletons";
import { readReportData } from "@/services/worktree-scanner";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wt: string }> }
) {
  const { wt } = await params;
  const wtName = decodeURIComponent(wt);
  const { dirs } = await getAdmin();
  const wtPath = join(dirs.WORKTREES_DIR, wtName);

  if (!existsSync(wtPath)) {
    return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
  }

  return NextResponse.json(readReportData(wtName, dirs.WORKTREES_DIR));
}
