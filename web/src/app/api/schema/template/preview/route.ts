import { NextResponse } from "next/server";
import { processTemplate } from "@/lib/wiki/template";
import { getResolvedDatasets } from "@/lib/datasets/queries";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import type { WikiDocument } from "@/lib/wiki/types";

export async function POST(req: Request) {
  const { text, agentId } = (await req.json()) as {
    text: string;
    agentId: string;
  };

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const { resolvedVars } = await getResolvedDatasets(agentId);

  const virtualDoc: WikiDocument = {
    id: "__schema_preview__",
    parentId: null,
    key: "",
    name: "Schema Preview",
    content: text,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  let rendered: string;
  try {
    rendered = processTemplate(text, {
      documents: [],
      currentDoc: virtualDoc,
      variables: resolvedVars,
    });
  } catch (e) {
    rendered = text;
    console.error("[schema/template/preview] render failed:", e);
  }

  return NextResponse.json({ rendered });
}
