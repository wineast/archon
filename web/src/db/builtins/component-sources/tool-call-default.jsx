import { useState } from "archon:react";
import { Badge } from "archon:ui";
import { CollapsibleSection } from "archon:ui";
import {
  WrenchIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CircleIcon,
  ChevronDownIcon,
} from "archon:icons";

/** Status icon mapping */
function StatusIcon({ state }) {
  if (state === "result") return <CheckCircleIcon className="size-3" />;
  if (state === "call") return <ClockIcon className="size-3 animate-spin" />;
  if (state === "partial-call") return <CircleIcon className="size-3" />;
  return <XCircleIcon className="size-3" />;
}

/** Status label mapping */
function statusLabel(state) {
  if (state === "result") return "Done";
  if (state === "call") return "Running";
  if (state === "partial-call") return "Preparing";
  return "Error";
}

/** Status badge variant mapping */
function statusVariant(state) {
  if (state === "result") return "secondary";
  if (state === "call") return "default";
  if (state === "partial-call") return "outline";
  return "destructive";
}

/** JSON display block */
function JsonBlock({ data }) {
  if (data === undefined || data === null) return null;
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
      <code>{text}</code>
    </pre>
  );
}

export default function ToolCallDefault({ tool, state }) {
  const hasInput =
    tool.input !== undefined &&
    tool.input !== null &&
    Object.keys(tool.input).length > 0;
  const hasOutput = tool.output !== undefined && tool.output !== null;

  return (
    <div className="my-2 overflow-hidden rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
        <WrenchIcon className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium">{tool.name}</span>
        <Badge variant={statusVariant(state)} className="gap-1 text-[10px]">
          <StatusIcon state={state} />
          {statusLabel(state)}
        </Badge>
      </div>

      {/* Parameters */}
      {hasInput && (
        <CollapsibleSection title="PARAMETERS" borderless>
          <div className="px-3 pb-2">
            <JsonBlock data={tool.input} />
          </div>
        </CollapsibleSection>
      )}

      {/* Result */}
      {hasOutput && (
        <CollapsibleSection title="RESULT" defaultOpen borderless>
          <div className="px-3 pb-2">
            <JsonBlock data={tool.output} />
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
