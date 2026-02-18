import { importSession } from "@/db/chat-persistence";
import { NextResponse } from "next/server";
import { requireAgentRole } from "@/lib/auth/require-agent-role";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate structure
    if (body.version !== 1) {
      return NextResponse.json(
        { error: "Unsupported export version" },
        { status: 400 }
      );
    }
    if (!body.session || !body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Invalid export format: missing session or messages" },
        { status: 400 }
      );
    }
    if (!body.session.title || !body.session.model) {
      return NextResponse.json(
        { error: "Invalid export format: session must have title and model" },
        { status: 400 }
      );
    }

    const agentId = new URL(req.url).searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json(
        { error: "agentId query parameter is required" },
        { status: 400 }
      );
    }

    const ctx = await requireAgentRole(agentId, "viewer");
    if (ctx instanceof NextResponse) return ctx;

    const result = await importSession({
      agentId,
      userId: ctx.user.id,
      title: body.session.title,
      model: body.session.model,
      createdAt: body.session.createdAt,
      messages: body.messages.map(
        (m: { role: string; parts: unknown[]; content?: string; createdAt?: string }) => ({
          role: m.role as "user" | "assistant" | "system",
          parts: m.parts,
          content: m.content,
          createdAt: m.createdAt,
        })
      ),
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Import session failed:", e);
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
