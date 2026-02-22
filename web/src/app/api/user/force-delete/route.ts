import { auth } from "@clerk/nextjs/server";
import { ensureUser } from "@/lib/auth/ensure-user";
import { immediateDeleteUser } from "@/lib/auth/account-deletion";

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUser(userId);
  await immediateDeleteUser(userId);
  return Response.json({ ok: true });
}
