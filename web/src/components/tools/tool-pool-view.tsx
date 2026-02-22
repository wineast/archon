"use client";

import { Badge } from "@/components/ui/badge";
import { JsEditor } from "@/components/editors/js-editor";
import { KeyField } from "@/components/ui/key-field";
import { InlineSchemaEditor } from "@/components/schemas/inline-schema-editor";
import type { ToolRow } from "@/db/schema";
import type { PoolMeta } from "@/components/pool/types";
import { PoolRefBadge } from "@/components/pool/pool-ref-badge";

interface ToolPoolViewProps {
  tool: ToolRow;
  poolMeta: PoolMeta;
}

export function ToolPoolView({ tool, poolMeta }: ToolPoolViewProps) {
  const isBuiltin = poolMeta.origin === "builtin";

  const executionTargetLabels: Record<string, string> = {
    server: "服务端",
    client: "浏览器",
    host: "宿主",
  };

  const sandboxModeLabels: Record<string, string> = {
    light: "轻量",
    full: "完整",
  };

  return (
    <div className="space-y-3 min-w-0">
      <PoolRefBadge origin={poolMeta.origin} />
      <KeyField value={tool.key} />
      <div>
        <p className="text-xs font-medium text-muted-foreground">Tool Name</p>
        <p className="mt-0.5 text-sm">{tool.name || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description</p>
        <p className="mt-0.5 text-sm whitespace-pre-wrap">
          {tool.description || "—"}
        </p>
      </div>
      <InlineSchemaEditor
        label="Input (JSON Schema / Template)"
        value={tool.parametersSchema ?? null}
        onChange={() => {}}
        readOnly
      />
      {isBuiltin ? (
        <p className="text-xs text-muted-foreground italic">
          系统内置工具的执行环境与 Handler 由平台管理，不可编辑。
        </p>
      ) : (
        <>
          <div>
            <p className="text-xs font-medium text-muted-foreground">执行环境</p>
            <Badge variant="outline" className="mt-1">
              {executionTargetLabels[tool.executionTarget ?? "server"] ?? tool.executionTarget}
            </Badge>
          </div>
          {tool.executionTarget === "host" ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Handler</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Handler 由宿主页面通过{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">ArchonEmbed.registerTools()</code>
                {" "}提供
              </p>
            </div>
          ) : tool.url?.trim() ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Handler (URL)</p>
              <p className="mt-0.5 text-sm font-mono">{tool.url}</p>
            </div>
          ) : tool.handler ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Handler (Code)</p>
              <div className="mt-1">
                <JsEditor value={tool.handler} onChange={() => {}} readOnly height="300px" />
              </div>
            </div>
          ) : null}
          {tool.executionTarget === "server" && tool.sandboxMode && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">沙盒</p>
              <Badge variant="outline" className="mt-1">
                {sandboxModeLabels[tool.sandboxMode] ?? tool.sandboxMode}
              </Badge>
            </div>
          )}
        </>
      )}
      <InlineSchemaEditor
        label="Output (JSON Schema / Template)"
        value={tool.returnParametersSchema ?? null}
        onChange={() => {}}
        readOnly
      />
      {tool.componentId && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">UI Component</p>
          <p className="mt-0.5 text-sm">{tool.componentId}</p>
        </div>
      )}
    </div>
  );
}
