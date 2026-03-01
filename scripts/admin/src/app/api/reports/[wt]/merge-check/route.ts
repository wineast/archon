import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAdmin } from "@/lib/singletons";
import { readMergeCheck } from "@/services/worktree-scanner";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wt: string }> }
) {
  const { wt } = await params;
  const wtName = decodeURIComponent(wt);
  const { dirs, mergeStates } = await getAdmin();
  const wtPath = join(dirs.WORKTREES_DIR, wtName);

  if (!existsSync(wtPath)) {
    return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
  }

  return NextResponse.json(
    readMergeCheck(wtName, dirs.WORKTREES_DIR, dirs.PROJECT_ROOT, mergeStates)
  );
}
