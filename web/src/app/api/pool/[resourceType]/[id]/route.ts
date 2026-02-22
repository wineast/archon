import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { RESOURCE_TYPES, agentResourceRefs } from "@/db/schema";
import type { ResourceType } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { RESOURCE_TABLE_MAP } from "@/lib/pool/constants";

function parseResourceType(raw: string): ResourceType | null {
  return RESOURCE_TYPES.includes(raw as ResourceType) ? (raw as ResourceType) : null;
}

/**
 * PATCH /api/pool/[resourceType]/[id] — edit a pool resource (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ resourceType: string; id: string }> },
) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { resourceType: rawType, id } = await params;
  const resourceType = parseResourceType(rawType);
  if (!resourceType) {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }

  const table = RESOURCE_TABLE_MAP[resourceType];

  // Verify the resource exists and is a pool resource (agentId IS NULL)
  const [existing] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((existing as Record<string, unknown>).agentId !== null) {
    return NextResponse.json({ error: "Not a pool resource" }, { status: 400 });
  }

  const body = await req.json();
  // Don't allow changing agentId
  delete body.agentId;
  delete body.id;

  const [updated] = await db.update(table).set(body).where(eq(table.id, id)).returning();
  return NextResponse.json(updated);
}

/**
 * DELETE /api/pool/[resourceType]/[id] — delete a pool resource (admin only)
 * Returns 409 if the resource is still referenced by agents.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ resourceType: string; id: string }> },
) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { resourceType: rawType, id } = await params;
  const resourceType = parseResourceType(rawType);
  if (!resourceType) {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }

  const table = RESOURCE_TABLE_MAP[resourceType];

  // Verify pool resource
  const [existing] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ((existing as Record<string, unknown>).agentId !== null) {
    return NextResponse.json({ error: "Not a pool resource" }, { status: 400 });
  }

  // Check for active references
  const refs = await db
    .select({ id: agentResourceRefs.id, agentId: agentResourceRefs.agentId })
    .from(agentResourceRefs)
    .where(
      and(
        eq(agentResourceRefs.resourceId, id),
        eq(agentResourceRefs.resourceType, resourceType),
      )
    );

  if (refs.length > 0) {
    return NextResponse.json(
      {
        error: "Resource is still referenced by agents",
        refCount: refs.length,
        agentIds: refs.map((r) => r.agentId),
      },
      { status: 409 }
    );
  }

  // Soft delete if table has deletedAt, hard delete otherwise
  if ("deletedAt" in table) {
    await db.update(table).set({ deletedAt: new Date() } as Record<string, unknown>).where(
      and(eq(table.id, id), isNull(table.agentId))
    );
  } else {
    await db.delete(table).where(eq(table.id, id));
  }

  return NextResponse.json({ ok: true });
}
