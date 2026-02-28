import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { processTemplate } from "@/lib/wiki/template";
import { getResolvedDatasets } from "@/lib/datasets/queries";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { resolveEditingVersionId } from "@/lib/versions/resolve";
import { expandSchemaRefs } from "@/lib/schemas/resolve-inline";
import { db } from "@/db";
import { schemas } from "@/db/schema";
import type { WikiDocument } from "@/lib/wiki/types";
import type { JsonSchema7 } from "@/lib/schemas/types";

export async function POST(req: Request) {
  const { text, agentId, expandRefs } = (await req.json()) as {
    text: string;
    agentId: string;
    expandRefs?: boolean;
  };

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const versionId = await resolveEditingVersionId(agentId);
  const { resolvedVars } = await getResolvedDatasets(agentId, versionId);

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

  // Optionally expand $ref references
  if (expandRefs) {
    try {
      const parsed = JSON.parse(rendered) as JsonSchema7;
      const allSchemaRows = await db
        .select({ key: schemas.key, parameters: schemas.parameters })
        .from(schemas)
        .where(and(eq(schemas.agentId, agentId), isNull(schemas.deletedAt)));

      const defsMap: Record<string, JsonSchema7> = {};
      for (const row of allSchemaRows) {
        defsMap[row.key] = row.parameters as JsonSchema7;
      }

      const expanded = expandSchemaRefs(parsed, defsMap);
      rendered = JSON.stringify(expanded, null, 2);
    } catch {
      // If rendered text isn't valid JSON, skip $ref expansion
    }
  }

  return NextResponse.json({ rendered });
}
