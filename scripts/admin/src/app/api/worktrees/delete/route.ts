import { spawn } from "node:child_process";
import { getAdmin } from "@/lib/singletons";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) {
    return new Response("Missing name", { status: 400 });
  }

  const { dirs } = await getAdmin();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const child = spawn("make", [`wt-delete`, `NAME=${name}`], {
        cwd: dirs.PROJECT_ROOT,
        shell: true,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      function send(type: string, data: string) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type, data })}\n\n`
          )
        );
      }

      child.stdout.on("data", (d: Buffer) => {
        const lines = d.toString().split("\n");
        for (const line of lines) {
          if (line) send("stdout", line);
        }
      });

      child.stderr.on("data", (d: Buffer) => {
        const lines = d.toString().split("\n");
        for (const line of lines) {
          if (line) send("stderr", line);
        }
      });

      child.on("close", (code) => {
        send("exit", String(code ?? 0));
        controller.close();
      });

      child.on("error", (err) => {
        send("error", err.message);
        controller.close();
      });

      req.signal.addEventListener("abort", () => {
        child.kill();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
