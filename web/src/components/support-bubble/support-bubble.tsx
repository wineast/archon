"use client";

import { useEffect } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SupportBubbleConfig {
  agentId: string;
  token: string;
}

interface SupportBubbleProps {
  orgId: string;
}

export function SupportBubble({ orgId }: SupportBubbleProps) {
  const { data } = useSWR<SupportBubbleConfig | null>(
    `/api/orgs/${orgId}/support-bubble`,
    fetcher
  );

  useEffect(() => {
    if (!data) return;

    const script = document.createElement("script");
    script.src = "/embed/widget.js";
    script.dataset.agentId = data.agentId;
    script.dataset.token = data.token;
    document.body.appendChild(script);

    return () => {
      script.remove();
      document.getElementById("archon-widget-container")?.remove();
      delete (window as never as Record<string, unknown>).ArchonEmbed;
    };
  }, [data]);

  return null;
}
