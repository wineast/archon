"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  PlayIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { useSchemaTestCases } from "@/lib/schemas/test-case-hooks";

interface SchemaPlaygroundProps {
  schemaId: string;
}

export function SchemaPlayground({ schemaId }: SchemaPlaygroundProps) {
  const [inputValue, setInputValue] = useState("{}");
  const [valid, setValid] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [running, setRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const { testCases } = useSchemaTestCases(schemaId);

  const handleValidate = useCallback(async () => {
    setValid(null);
    setErrors([]);
    setDurationMs(null);
    setRunning(true);

    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(inputValue);
    } catch {
      setValid(false);
      setErrors([{ path: "", message: "Invalid JSON input" }]);
      setRunning(false);
      return;
    }

    try {
      const res = await fetch(`/api/schemas/${schemaId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: parsedInput }),
      });

      const data = await res.json();
      setValid(data.valid);
      setErrors(data.errors ?? []);
      setDurationMs(data.durationMs ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      setValid(false);
      setErrors([{ path: "", message: msg }]);
    } finally {
      setRunning(false);
    }
  }, [inputValue, schemaId]);

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
              height="200px"
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Result
              </label>
              {durationMs != null && (
                <span className="text-xs text-muted-foreground">
                  {durationMs}ms
                </span>
              )}
            </div>
            {valid === true ? (
              <div className="mt-1 flex items-center gap-2 rounded bg-green-50 p-3 dark:bg-green-950/30">
                <CheckCircle2Icon className="size-4 text-green-600" />
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Valid
                </Badge>
              </div>
            ) : valid === false ? (
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2 rounded bg-destructive/10 p-3">
                  <XCircleIcon className="size-4 text-destructive" />
                  <Badge variant="destructive">
                    Invalid ({errors.length} {errors.length === 1 ? "error" : "errors"})
                  </Badge>
                </div>
                {errors.length > 0 && (
                  <div className="space-y-1">
                    {errors.map((err, i) => (
                      <div key={i} className="rounded bg-destructive/10 px-3 py-2 text-xs">
                        <span className="font-mono text-destructive">{err.path || "(root)"}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 rounded bg-muted p-3 text-xs text-muted-foreground">
                Click Validate to check input against schema
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="flex items-center border-t px-4 py-2">
        <Button
          size="sm"
          onClick={handleValidate}
          disabled={running}
          className="gap-1"
        >
          {running ? <Spinner className="size-3" /> : <PlayIcon className="size-3" />}
          Validate
        </Button>
      </div>
    </div>
  );
}
