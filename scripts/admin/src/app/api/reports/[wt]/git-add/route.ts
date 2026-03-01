import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAdmin } from "@/lib/singletons";
import { exec } from "@/services/git-ops";

export const dynamic = "force-dynamic";

export async function POST(
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

  exec("git add .", wtPath);
  return NextResponse.json({ ok: true });
}
