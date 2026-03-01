import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/singletons";
import { getTaskStatus, moveTaskStatus } from "@/services/task-scanner";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { dirs, hooks } = await getAdmin();
  const { TODO_DIR, ISSUES_DIR } = dirs;

  try {
    const { type, id, to } = await req.json();

    const from = getTaskStatus(type, id, TODO_DIR, ISSUES_DIR);
    if (from === null) {
      return NextResponse.json(
        { error: `Task not found: ${id}` },
        { status: 404 }
      );
    }
    if (from === to) {
      return NextResponse.json({ ok: true, moved: false });
    }

    const result = moveTaskStatus(type, id, to, TODO_DIR, ISSUES_DIR);
    if (result.error) {
      const status = result.error.startsWith("Task not found") ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    if (result.moved) {
      await hooks.run({ type, id, from, to, dirs });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
