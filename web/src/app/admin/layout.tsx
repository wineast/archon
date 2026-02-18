import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    redirect("/");
  }

  const [user] = await db
    .select({ platformRole: users.platformRole })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user || user.platformRole !== "super_admin") {
    redirect("/");
  }

  return <>{children}</>;
}
