"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDownIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { JsonEditor } from "@/components/ui/editors/json-editor";
import { Spinner } from "@/components/ui/spinner";
import type { ToolParameter } from "@/lib/tools/types";

interface HandlerTestPanelProps {
  handler: string;
  parameters: ToolParameter[];
}

function buildDefaults(parameters: ToolParameter[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const p of parameters) {
    switch (p.type) {
      case "number":
        obj[p.name] = 0;
        break;
      case "boolean":
        obj[p.name] = false;
        break;
      case "json":
        obj[p.name] =
          p.properties && p.properties.length > 0
            ? buildDefaults(p.properties)
            : {};
        break;
      default:
        obj[p.name] = "";
    }
  }
  return obj;
}

function buildDefaultArgs(parameters: ToolParameter[]): string {
  return JSON.stringify(buildDefaults(parameters), null, 2);
}

export function HandlerTestPanel({
  handler,
  parameters,
}: HandlerTestPanelProps) {
  const defaultArgs = useMemo(() => buildDefaultArgs(parameters), [parameters]);
  const [argsInput, setArgsInput] = useState(defaultArgs);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);

  // Reset argsInput when parameters change
  const prevDefaultRef = useMemo(() => defaultArgs, [defaultArgs]);
  if (argsInput === "" && prevDefaultRef) {
    setArgsInput(prevDefaultRef);
  }

  const handleRun = useCallback(async () => {
    setError(null);
    setOutput("");
    setRunning(true);

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(argsInput);
    } catch {
      setError("参数 JSON 格式错误");
      setRunning(false);
      return;
    }

    try {
      const res = await fetch("/api/tools/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handler, args: parsedArgs }),
      });

      const data = await res.json();

      if (data.success) {
        setOutput(JSON.stringify(data.result, null, 2));
      } else {
        setError(data.error ?? "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`测试请求失败: ${msg}`);
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, [argsInput, handler]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 px-0 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDownIcon
            className={`size-3 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          测试
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              参数 (JSON)
            </label>
            <JsonEditor
              value={argsInput}
              onChange={setArgsInput}
              height="100px"
              className="mt-1"
            />
          </div>

          {output && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                输出
              </label>
              <JsonEditor
                value={output}
                readOnly
                height="120px"
                className="mt-1"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive whitespace-pre-wrap">
              {error}
            </p>
          )}

          <Button
            size="sm"
            onClick={handleRun}
            disabled={running}
            className="gap-1"
          >
            {running ? <Spinner className="size-3" /> : <PlayIcon className="size-3" />}
            运行
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
