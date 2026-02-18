"use client";

import { useCallback, useState } from "react";
import { ChevronDownIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JsonEditor } from "@/components/ui/editors/json-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { BuiltinTestCase } from "@/lib/functions/builtin";

interface BuiltinPlaygroundProps {
  builtinKey: string;
  testCases?: BuiltinTestCase[];
}

export function BuiltinPlayground({ builtinKey, testCases }: BuiltinPlaygroundProps) {
  const [inputValue, setInputValue] = useState("{}");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const handleRun = useCallback(async () => {
    setError(null);
    setOutput("");
    setDurationMs(null);
    setRunning(true);

    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputValue);
    } catch {
      setError("Invalid JSON input");
      setRunning(false);
      return;
    }

    try {
      const res = await fetch("/api/functions/builtin/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: builtinKey, input: parsedInput }),
      });

      const data = await res.json();
      setDurationMs(data.durationMs ?? null);

      if (data.success) {
        setOutput(JSON.stringify(data.result, null, 2));
      } else {
        setError(data.error ?? "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, [inputValue, builtinKey]);

  const handleLoadTestCase = useCallback((tc: BuiltinTestCase) => {
    setInputValue(JSON.stringify(tc.input, null, 2));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Input
              </label>
              {testCases && testCases.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 gap-0.5 px-1.5 text-xs text-muted-foreground">
                      Test Cases
                      <ChevronDownIcon className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {testCases.map((tc, i) => (
                      <DropdownMenuItem key={i} onClick={() => handleLoadTestCase(tc)}>
                        {tc.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <JsonEditor
              value={inputValue}
              onChange={setInputValue}
              height="150px"
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Output
              </label>
              {durationMs != null && (
                <span className="text-xs text-muted-foreground">
                  {durationMs}ms
                </span>
              )}
            </div>
            {output ? (
              <pre className="mt-1 rounded bg-muted p-2 text-sm overflow-x-auto whitespace-pre-wrap">
                {output}
              </pre>
            ) : error ? (
              <div className="mt-1 rounded bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap">
                {error}
              </div>
            ) : (
              <div className="mt-1 rounded bg-muted p-2 text-xs text-muted-foreground">
                Run to see output
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="flex items-center border-t px-4 py-2">
        <Button
          size="sm"
          onClick={handleRun}
          disabled={running}
          className="gap-1"
        >
          {running ? <Spinner className="size-3" /> : <PlayIcon className="size-3" />}
          Run
        </Button>
      </div>
    </div>
  );
}
