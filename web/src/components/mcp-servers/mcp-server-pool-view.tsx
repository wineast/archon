"use client";

import { useCallback, useState } from "react";
import { PlugIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyDisplay } from "@/components/ui/key-display";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { testMcpServer, type McpToolDef } from "@/lib/mcp-servers/hooks";
import type { McpServerRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";
import { PoolRefBadge } from "@/components/pool/pool-ref-badge";

interface McpServerPoolViewProps {
  mcpServer: McpServerRow;
  poolMeta: PoolMeta;
  onTestSuccess: (tools: McpToolDef[], config: { url: string; transportType: string; headers: Record<string, string> }) => void;
}

export function McpServerPoolView({ mcpServer, poolMeta, onTestSuccess }: McpServerPoolViewProps) {
  const [testing, setTesting] = useState(false);
  const headers = (mcpServer.headers ?? {}) as Record<string, string>;
  const headerEntries = Object.entries(headers);

  const transportTypeLabels: Record<string, string> = {
    sse: "SSE (Server-Sent Events)",
    http: "HTTP (Streamable HTTP)",
  };

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const config = { url: mcpServer.url, transportType: mcpServer.transportType, headers };
      const result = await testMcpServer(mcpServer.id, config);
      if (result.ok && result.tools) {
        toast.success(`Connected! Found ${result.toolCount} tool(s)`);
        onTestSuccess(result.tools, config);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } finally {
      setTesting(false);
    }
  }, [mcpServer.id, mcpServer.url, mcpServer.transportType, headers, onTestSuccess]);

  return (
    <div className="space-y-4">
      <PoolRefBadge origin={poolMeta.origin} />
      <KeyDisplay value={mcpServer.key} />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Name</p>
        <p className="mt-0.5 text-sm">{mcpServer.name || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description</p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">{mcpServer.description || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">URL</p>
        <p className="mt-0.5 text-sm font-mono">{mcpServer.url || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Transport Type</p>
        <Badge variant="outline" className="mt-1">
          {transportTypeLabels[mcpServer.transportType] ?? mcpServer.transportType}
        </Badge>
      </div>
      {headerEntries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Headers</p>
          <div className="mt-1 space-y-1">
            {headerEntries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-muted-foreground">{key}:</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={testing}
      >
        {testing ? (
          <Spinner className="mr-1 size-3" />
        ) : (
          <PlugIcon className="mr-1 size-3" />
        )}
        {testing ? "Testing..." : "Test Connection"}
      </Button>
    </div>
  );
}
