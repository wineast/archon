import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agentResourceRefs, RESOURCE_TYPES } from "@/db/schema";
import type { ResourceType } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { RESOURCE_TABLE_MAP } from "@/lib/pool/constants";

/**
 * GET /api/agents/[id]/refs — list all resource refs for an agent
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const authResult = await requireAgentRole(agentId, "viewer");
  if (authResult instanceof NextResponse) return authResult;

  const refs = await db
    .select()
    .from(agentResourceRefs)
    .where(eq(agentResourceRefs.agentId, agentId));

  return NextResponse.json(refs);
}

/**
 * POST /api/agents/[id]/refs — add a pool resource reference
 * Body: { resourceType, resourceId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params;
  const authResult = await requireAgentRole(agentId, "editor");
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { resourceType, resourceId } = body as {
    resourceType: string;
    resourceId: string;
  };

  if (!resourceType || !resourceId) {
    return NextResponse.json(
      { error: "resourceType and resourceId are required" },
      { status: 400 },
    );
  }

  if (!RESOURCE_TYPES.includes(resourceType as ResourceType)) {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }

  const table = RESOURCE_TABLE_MAP[resourceType as ResourceType];

  // Verify the resource exists and is a pool resource (agentId IS NULL)
  const [resource] = await db
    .select({ id: table.id, agentId: table.agentId })
    .from(table)
    .where(and(eq(table.id, resourceId), isNull(table.agentId)))
    .limit(1);

  if (!resource) {
    return NextResponse.json(
      { error: "Pool resource not found" },
      { status: 404 },
    );
  }

  const [created] = await db
    .insert(agentResourceRefs)
    .values({
      agentId,
      resourceType: resourceType as ResourceType,
      resourceId,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    // Already exists
    const [existing] = await db
      .select()
      .from(agentResourceRefs)
      .where(
        and(
          eq(agentResourceRefs.agentId, agentId),
          eq(agentResourceRefs.resourceType, resourceType as ResourceType),
          eq(agentResourceRefs.resourceId, resourceId),
        ),
      )
      .limit(1);
    return NextResponse.json(existing);
  }

  return NextResponse.json(created, { status: 201 });
}
