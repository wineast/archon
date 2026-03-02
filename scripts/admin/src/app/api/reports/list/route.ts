import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/singletons";
import { listReportWorktrees } from "@/services/worktree-scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const { dirs } = await getAdmin();
  return NextResponse.json(listReportWorktrees(dirs.WORKTREES_DIR));
}
