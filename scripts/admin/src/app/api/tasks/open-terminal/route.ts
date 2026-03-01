import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAdmin } from "@/lib/singletons";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { dirs, termManager } = await getAdmin();

  try {
    const { worktree, skill } = await req.json();
    const wtPath = join(dirs.WORKTREES_DIR, worktree);

    if (!existsSync(wtPath)) {
      return NextResponse.json(
        { error: `Worktree not found: ${worktree}` },
        { status: 404 }
      );
    }

    const sessionId = skill ? `${worktree}::${skill}` : worktree;

    if (termManager.has(sessionId) && termManager.activate(sessionId)) {
      return NextResponse.json({ ok: true, activated: true });
    }

    const initialCommand = skill ? `claude ${skill}` : undefined;
    termManager.create(sessionId, wtPath, initialCommand);
    return NextResponse.json({ ok: true, activated: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
