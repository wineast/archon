import { auth } from "@clerk/nextjs/server";
import { ensureUser } from "@/lib/auth/ensure-user";
import { cancelAccountDeletion } from "@/lib/auth/account-deletion";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUser(userId);
  const updated = await cancelAccountDeletion(userId);
  return Response.json(updated);
}
