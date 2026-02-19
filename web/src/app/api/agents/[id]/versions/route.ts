import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentVersions, users } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAgentRole } from "@/lib/auth/require-agent-role";
import { buildSnapshot } from "@/lib/versions/snapshot";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** GET — list versions (without snapshot) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "viewer");
  if (ctx instanceof NextResponse) return ctx;

  const rows = await db
    .select({
      id: agentVersions.id,
      agentId: agentVersions.agentId,
      version: agentVersions.version,
      changelog: agentVersions.changelog,
      createdBy: agentVersions.createdBy,
      createdAt: agentVersions.createdAt,
      creatorNickname: users.nickname,
      creatorEmail: users.email,
    })
    .from(agentVersions)
    .leftJoin(users, eq(agentVersions.createdBy, users.id))
    .where(eq(agentVersions.agentId, agentId))
    .orderBy(desc(agentVersions.createdAt));

  return NextResponse.json(rows);
}

/** POST — publish a new version */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const ctx = await requireAgentRole(agentId, "admin");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { version, changelog } = body as {
    version: string;
    changelog?: string;
  };

  if (!version || !SEMVER_RE.test(version)) {
    return NextResponse.json(
      { error: "Invalid version format. Use SemVer (e.g. 1.0.0)" },
      { status: 400 }
    );
  }

  // Check for duplicate version
  const [existing] = await db
    .select({ id: agentVersions.id })
    .from(agentVersions)
    .where(
      and(
        eq(agentVersions.agentId, agentId),
        eq(agentVersions.version, version)
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: `Version ${version} already exists` },
      { status: 409 }
    );
  }

  const snapshot = await buildSnapshot(agentId);

  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(agentVersions)
      .values({
        agentId,
        version,
        changelog: changelog ?? "",
        snapshot,
        createdBy: ctx.user.id,
      })
      .returning();

    await tx
      .update(agents)
      .set({ editingVersionId: inserted[0].id })
      .where(eq(agents.id, agentId));

    return inserted;
  });

  return NextResponse.json(row, { status: 201 });
}
