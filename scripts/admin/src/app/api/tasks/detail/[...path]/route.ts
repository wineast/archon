import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/singletons";
import { readTaskContent } from "@/services/task-scanner";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const taskPath = path.join("/");
  const { dirs } = await getAdmin();

  const content = readTaskContent(dirs.PROJECT_ROOT, taskPath);
  if (content === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ content });
}
