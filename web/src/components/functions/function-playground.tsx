"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDownIcon, PlayIcon, SaveIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  useFunctionTestCases,
  createFunctionTestCase,
} from "@/lib/functions/test-case-hooks";

interface FunctionPlaygroundProps {
  functionId: string;
}

export function FunctionPlayground({ functionId }: FunctionPlaygroundProps) {
  const [inputValue, setInputValue] = useState("{}");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const { testCases, mutate: mutateCases } = useFunctionTestCases(functionId);

  // Save dialog state
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTags, setSaveTags] = useState<string[]>([]);
  const [saveTagInput, setSaveTagInput] = useState("");
  const [saveShowAsExample, setSaveShowAsExample] = useState(false);
  const [saving, setSaving] = useState(false);

  // Split test cases into examples and non-examples for grouped dropdown
  const { examples, nonExamples } = useMemo(() => {
    const ex: typeof testCases = [];
    const ne: typeof testCases = [];
    for (const tc of testCases) {
      if (tc.showAsExample) ex.push(tc);
      else ne.push(tc);
    }
    return { examples: ex, nonExamples: ne };
  }, [testCases]);

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

  // Save dialog handlers
  const handleOpenSave = useCallback(() => {
    setSaveName("");
    setSaveTags([]);
    setSaveTagInput("");
    setSaveShowAsExample(false);
    setSaveOpen(true);
  }, []);

  const handleAddSaveTag = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && !saveTags.includes(trimmed)) {
        setSaveTags([...saveTags, trimmed]);
      }
      setSaveTagInput("");
    },
    [saveTags]
  );

  const handleSaveTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddSaveTag(saveTagInput);
      }
    },
    [saveTagInput, handleAddSaveTag]
  );

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    let parsedIn: Record<string, unknown>;
    try {
      parsedIn = JSON.parse(inputValue);
    } catch {
      toast.error("Invalid input JSON");
      return;
    }
    let expectedOutput: unknown = undefined;
    if (output.trim()) {
      try {
        expectedOutput = JSON.parse(output);
      } catch {
        // output may not be valid JSON, skip
      }
    }
    setSaving(true);
    try {
      const result = await createFunctionTestCase(
        functionId,
        {
          name: saveName.trim(),
          input: parsedIn,
          expectedOutput,
          tags: saveTags.length > 0 ? saveTags : undefined,
          showAsExample: saveShowAsExample || undefined,
        },
        mutateCases
      );
      if (result) {
        toast.success("Test case saved");
        setSaveOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }, [
    saveName,
    inputValue,
    output,
    saveTags,
    saveShowAsExample,
    functionId,
    mutateCases,
  ]);

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
                      Load
                      <ChevronDownIcon className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {examples.length > 0 && (
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Examples</DropdownMenuLabel>
                        {examples.map((tc) => (
                          <DropdownMenuItem
                            key={tc.id}
                            onClick={() => handleLoadTestCase(tc.input)}
                          >
                            {tc.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    )}
                    {examples.length > 0 && nonExamples.length > 0 && (
                      <DropdownMenuSeparator />
                    )}
                    {nonExamples.length > 0 && (
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Test Cases</DropdownMenuLabel>
                        {nonExamples.map((tc) => (
                          <DropdownMenuItem
                            key={tc.id}
                            onClick={() => handleLoadTestCase(tc.input)}
                          >
                            {tc.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    )}
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

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          size="sm"
          onClick={handleRun}
          disabled={running}
          className="gap-1"
        >
          {running ? <Spinner className="size-3" /> : <PlayIcon className="size-3" />}
          Run
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleOpenSave}
          className="gap-1"
        >
          <SaveIcon className="size-3" />
          Save
        </Button>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Test Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                autoFocus
                className="h-8 text-sm"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="e.g. Basic function test"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label className="text-xs">Tags</Label>
              <div className="flex flex-wrap items-center gap-1 rounded-md border px-2 py-1.5">
                {saveTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        setSaveTags(saveTags.filter((t) => t !== tag))
                      }
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  className="h-6 min-w-[80px] flex-1 border-none px-1 text-xs shadow-none focus-visible:ring-0"
                  value={saveTagInput}
                  onChange={(e) => setSaveTagInput(e.target.value)}
                  onKeyDown={handleSaveTagKeyDown}
                  onBlur={() =>
                    saveTagInput.trim() && handleAddSaveTag(saveTagInput)
                  }
                  placeholder="Add tag..."
                />
              </div>
            </div>

            {/* Show as Example */}
            <div className="flex items-center gap-2">
              <Switch
                id="save-show-as-example"
                checked={saveShowAsExample}
                onCheckedChange={setSaveShowAsExample}
              />
              <Label
                htmlFor="save-show-as-example"
                className="text-xs font-medium text-muted-foreground"
              >
                Show as Example
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!saveName.trim() || saving}
              className="gap-1"
            >
              {saving ? (
                <Spinner className="size-3" />
              ) : (
                <SaveIcon className="size-3" />
              )}
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
