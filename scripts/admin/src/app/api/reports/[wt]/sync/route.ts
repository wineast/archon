import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getAdmin } from "@/lib/singletons";

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

  const scriptPath = join(
    dirs.PROJECT_ROOT,
    "scripts",
    "worktree",
    "worktree.mjs"
  );
  if (!existsSync(scriptPath)) {
    return NextResponse.json(
      { ok: false, error: "Cannot find worktree.mjs" },
      { status: 400 }
    );
  }

  try {
    execSync(`node ${scriptPath} sync`, {
      cwd: wtPath,
      timeout: 30000,
      stdio: "pipe",
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; message: string };
    return NextResponse.json(
      { ok: false, error: err.stderr?.toString() || err.message },
      { status: 500 }
    );
  }
}
