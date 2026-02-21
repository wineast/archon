import { redirect } from "next/navigation";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ orgSlug: string; agentSlug: string }>;
}) {
  const { orgSlug, agentSlug } = await params;
  redirect(`/${orgSlug}/${agentSlug}/chat`);
}
