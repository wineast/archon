import { redirect } from "next/navigation";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agentSlug: string }>;
}) {
  const { agentSlug } = await params;
  redirect(`/${agentSlug}/chat`);
}
