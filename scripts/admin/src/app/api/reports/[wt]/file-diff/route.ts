import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAdmin } from "@/lib/singletons";
import { getBaseBranch, getFileDiff, type DiffSource } from "@/services/git-ops";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wt: string }> }
) {
  const { wt } = await params;
  const wtName = decodeURIComponent(wt);
  const { dirs } = await getAdmin();
  const wtPath = join(dirs.WORKTREES_DIR, wtName);
  const wtDir = join(wtPath, ".worktree");

  if (!existsSync(wtPath)) {
    return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");
  const source = url.searchParams.get("source") || "committed";

  if (!filePath) {
    return NextResponse.json(
      { error: "Missing path parameter" },
      { status: 400 }
    );
  }

  const validSources = ["committed", "staged", "working", "untracked"];
  if (!validSources.includes(source)) {
    return NextResponse.json(
      { error: `Invalid source: ${source}` },
      { status: 400 }
    );
  }

  const baseBranch = getBaseBranch(wtDir);
  const diff = getFileDiff(wtPath, baseBranch, filePath, source as DiffSource);
  return NextResponse.json({ diff, filePath });
}
