import { existsSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { getAdmin } from "@/lib/singletons";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wt: string; path: string[] }> }
) {
  const { wt, path } = await params;
  const wtName = decodeURIComponent(wt);
  const { dirs } = await getAdmin();
  const wtDir = join(dirs.WORKTREES_DIR, wtName, ".worktree");
  const relPath = path.join("/");
  const filePath = join(wtDir, relPath);

  if (!filePath.startsWith(wtDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return new Response("File not found", { status: 404 });
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const buffer = readFileSync(filePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
    },
  });
}
