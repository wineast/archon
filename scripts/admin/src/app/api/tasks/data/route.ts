import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/singletons";
import { scanTasks } from "@/services/task-scanner";
import { scanWorktrees } from "@/services/worktree-scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const { dirs, termManager } = await getAdmin();
  const { PROJECT_ROOT, WORKTREES_DIR, TODO_DIR, ISSUES_DIR } = dirs;

  const tasks = scanTasks(PROJECT_ROOT, TODO_DIR, ISSUES_DIR);
  const worktrees = scanWorktrees(WORKTREES_DIR);

  for (const task of tasks) {
    task.chain = null;
    task.terminals = [];
    if (task.worktree) {
      const wt = worktrees.find((w) => w.name === task.worktree);
      if (wt) {
        task.chain = wt.reqChain || wt.defectChain || null;
        const prefix = `${task.worktree}::`;
        task.terminals = termManager
          .verifyByPrefix(prefix)
          .map((key) => key.slice(prefix.length));
      }
    }
  }

  return NextResponse.json({
    tasks,
    worktrees,
    stats: {
      total: tasks.length,
      ready: tasks.filter((t) => t.status === "ready").length,
      active: tasks.filter((t) => t.status === "ready" && t.worktree).length,
      completed: tasks.filter((t) =>
        ["merged", "cancelled", "wontfix"].includes(t.status)
      ).length,
      todoCount: tasks.filter((t) => t.type === "todo").length,
      issueCount: tasks.filter((t) => t.type === "issue").length,
    },
  });
}
