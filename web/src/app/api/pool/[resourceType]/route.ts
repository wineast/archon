import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { RESOURCE_TYPES } from "@/db/schema";
import type { ResourceType } from "@/db/schema";
import { isNull, asc } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "@/lib/auth/require-agent-role";
import { RESOURCE_TABLE_MAP } from "@/lib/pool/constants";

function parseResourceType(raw: string): ResourceType | null {
  return RESOURCE_TYPES.includes(raw as ResourceType) ? (raw as ResourceType) : null;
}

/**
 * GET /api/pool/[resourceType] — list pool resources (agentId IS NULL)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ resourceType: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { resourceType: rawType } = await params;
  const resourceType = parseResourceType(rawType);
  if (!resourceType) {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }

  const table = RESOURCE_TABLE_MAP[resourceType];
  const rows = await db
    .select()
    .from(table)
    .where(isNull(table.agentId))
    .orderBy(asc(table.key));

  // Filter out soft-deleted if table has deletedAt
  const filtered = "deletedAt" in table
    ? rows.filter((r: Record<string, unknown>) => r.deletedAt == null)
    : rows;

  return NextResponse.json(filtered);
}

/**
 * POST /api/pool/[resourceType] — create a pool resource (admin only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resourceType: string }> },
) {
  const authResult = await requireSuperAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const { resourceType: rawType } = await params;
  const resourceType = parseResourceType(rawType);
  if (!resourceType) {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }

  const body = await req.json();
  const table = RESOURCE_TABLE_MAP[resourceType];

  // Ensure agentId is null for pool resources
  const [created] = await db
    .insert(table)
    .values({ ...body, agentId: null })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
