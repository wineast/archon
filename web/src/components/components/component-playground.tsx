"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicToolRenderer, DynamicComponentErrorBoundary } from "@/tool-ui";
import { useComponentTestCases } from "@/lib/components/test-case-hooks";

interface ComponentPlaygroundProps {
  componentId: string;
  componentSource: string;
}

export function ComponentPlayground({
  componentId,
  componentSource,
}: ComponentPlaygroundProps) {
  const [toolName, setToolName] = useState("");
  const [inputValue, setInputValue] = useState("{}");
  const [outputValue, setOutputValue] = useState("{}");
  const [previewKey, setPreviewKey] = useState(0);

  const { testCases } = useComponentTestCases(componentId);

  const parsedInput = useMemo(() => {
    try {
      return JSON.parse(inputValue || "{}");
    } catch {
      return {};
    }
  }, [inputValue]);

  const parsedOutput = useMemo(() => {
    try {
      return JSON.parse(outputValue || "{}");
    } catch {
      return {};
    }
  }, [outputValue]);

  const handleRefresh = useCallback(() => {
    setPreviewKey((k) => k + 1);
  }, []);

  const handleLoadTestCase = useCallback(
    (tool: { name: string; input: unknown; output: unknown }) => {
      setToolName(tool.name);
      setInputValue(JSON.stringify(tool.input, null, 2));
      setOutputValue(JSON.stringify(tool.output, null, 2));
      setPreviewKey((k) => k + 1);
    },
    []
  );

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          {/* Tool Name */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Tool Name
              </label>
              {testCases.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 gap-0.5 px-1.5 text-xs text-muted-foreground"
                    >
                      Test Cases
                      <ChevronDownIcon className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {testCases.map((tc) => (
                      <DropdownMenuItem
                        key={tc.id}
                        onClick={() => handleLoadTestCase(tc.tool)}
                      >
                        {tc.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Input
              className="mt-1 h-8 text-sm"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder="e.g. get_weather"
            />
          </div>

          {/* Tool Input */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tool Input (JSON)
            </label>
            <JsonEditor
              value={inputValue}
              onChange={setInputValue}
              height="120px"
              className="mt-1"
            />
          </div>

          {/* Tool Output */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tool Output (JSON)
            </label>
            <JsonEditor
              value={outputValue}
              onChange={setOutputValue}
              height="120px"
              className="mt-1"
            />
          </div>

          {/* Preview */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Preview
            </label>
            {componentSource.trim() ? (
              <div className="mt-1 rounded-md border p-3">
                <DynamicComponentErrorBoundary
                  key={previewKey}
                  fallbackToolName={toolName || "preview"}
                >
                  <DynamicToolRenderer
                    tool={{
                      name: toolName,
                      input: parsedInput,
                      output: parsedOutput,
                    }}
                    state="output-available"
                    source={componentSource}
                  />
                </DynamicComponentErrorBoundary>
              </div>
            ) : (
              <div className="mt-1 rounded bg-muted p-2 text-xs text-muted-foreground">
                No component source to render
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="flex items-center border-t px-4 py-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          className="gap-1"
        >
          <RefreshCwIcon className="size-3" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
