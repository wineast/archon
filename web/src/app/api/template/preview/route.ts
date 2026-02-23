import { NextResponse } from "next/server";
import { gatherTemplateData, renderTemplate, disposeTemplateData } from "@/lib/template/render";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { getDatasets, resolveDatasets, renderField, renderObjectField } from "@/lib/datasets/queries";

export async function POST(req: Request) {
  const { text, agentId, mode, hostContext } = (await req.json()) as {
    text: string;
    agentId: string;
    mode?: "dataset";
    hostContext?: Record<string, unknown>;
  };

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  if (mode === "dataset") {
    // Dataset data preview: only inject dataset context, no built-in vars / tool / ontology
    const rows = await getDatasets(agentId);
    const { resolvedVars } = resolveDatasets(rows);
    let rendered: string;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        rendered = JSON.stringify(renderObjectField(parsed, resolvedVars), null, 2);
      } else {
        rendered = text;
      }
    } catch {
      rendered = renderField(text, resolvedVars);
    }
    return NextResponse.json({ rendered });
  }

  const versionId = await resolveEditingVersionId(agentId);
  const data = await gatherTemplateData(agentId, versionId);
  try {
    const rendered = await renderTemplate(text, data, hostContext ? { host: hostContext } : undefined);
    return NextResponse.json({ rendered });
  } finally {
    disposeTemplateData(data);
  }
}
