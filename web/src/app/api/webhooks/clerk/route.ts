import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

interface ClerkUserEvent {
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    image_url?: string;
    first_name?: string;
    last_name?: string;
  };
  type: string;
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return Response.json(
      { error: "Missing CLERK_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkUserEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = evt;
  const email = data.email_addresses[0]?.email_address ?? "";
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ");

  if (type === "user.created") {
    await db.insert(users).values({
      clerkId: data.id,
      email,
      nickname: name || null,
      avatarUrl: data.image_url ?? null,
    });
  }

  if (type === "user.updated") {
    await db
      .update(users)
      .set({
        email,
        avatarUrl: data.image_url ?? null,
      })
      .where(eq(users.clerkId, data.id));
  }

  if (type === "user.deleted") {
    await db.delete(users).where(eq(users.clerkId, data.id));
  }

  return Response.json({ success: true });
}
