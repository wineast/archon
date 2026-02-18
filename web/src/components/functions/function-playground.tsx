"use client";

import { useCallback, useState } from "react";
import { ChevronDownIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JsonEditor } from "@/components/editors/json-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useFunctionTestCases } from "@/lib/functions/test-case-hooks";

interface FunctionPlaygroundProps {
  functionId: string;
}

export function FunctionPlayground({ functionId }: FunctionPlaygroundProps) {
  const [inputValue, setInputValue] = useState("{}");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const { testCases } = useFunctionTestCases(functionId);

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
      const res = await fetch(`/api/functions/${functionId}/test-cases/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: parsedInput }),
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
  }, [inputValue, functionId]);

  const handleLoadTestCase = useCallback((input: unknown) => {
    setInputValue(JSON.stringify(input, null, 2));
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
              {testCases.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 gap-0.5 px-1.5 text-xs text-muted-foreground">
                      Test Cases
                      <ChevronDownIcon className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {testCases.map((tc) => (
                      <DropdownMenuItem key={tc.id} onClick={() => handleLoadTestCase(tc.input)}>
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
              <JsonEditor
                value={output}
                readOnly
                height="200px"
                className="mt-1"
              />
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
