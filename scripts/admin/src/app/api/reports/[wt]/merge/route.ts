import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { getAdmin } from "@/lib/singletons";
import { exec as gitExec, getBaseBranch } from "@/services/git-ops";
import { markTaskMerged } from "@/services/task-scanner";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ wt: string }> }
) {
  const { wt } = await params;
  const wtName = decodeURIComponent(wt);
  const { dirs, mergeStates } = await getAdmin();
  const wtPath = join(dirs.WORKTREES_DIR, wtName);
  const wtDir = join(wtPath, ".worktree");

  if (!existsSync(wtPath)) {
    return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
  }

  if (mergeStates.get(wtName) === "success") {
    return NextResponse.json(
      { ok: false, error: "Already merged" },
      { status: 409 }
    );
  }

  const baseBranch = getBaseBranch(wtDir);
  try {
    const behind = gitExec(
      `git rev-list HEAD..${baseBranch} --count`,
      wtPath
    );
    if (behind !== "0") {
      return NextResponse.json(
        {
          ok: false,
          error: `落后上游 ${behind} 个 commit，请先同步`,
        },
        { status: 409 }
      );
    }
  } catch {
    /* ignore */
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
    execSync(`node ${scriptPath} merge ${wtName}`, {
      cwd: dirs.PROJECT_ROOT,
      timeout: 60000,
      stdio: "pipe",
    });
    mergeStates.set(wtName, "success");

    const taskResult = markTaskMerged(
      wtName,
      dirs.TODO_DIR,
      dirs.ISSUES_DIR
    );
    return NextResponse.json({ ok: true, task: taskResult });
  } catch (e: unknown) {
    mergeStates.set(wtName, "failed");
    const err = e as { stderr?: Buffer; message: string };
    return NextResponse.json(
      { ok: false, error: err.stderr?.toString() || err.message },
      { status: 500 }
    );
  }
}
