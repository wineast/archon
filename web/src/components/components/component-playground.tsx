"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  RefreshCwIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  DynamicToolRenderer,
  DynamicComponentErrorBoundary,
  compileComponentGraph,
  type ComponentRecord,
} from "@/tool-ui";
import {
  useComponentTestCases,
  createComponentTestCase,
} from "@/lib/components/test-case-hooks";
import {
  validateAgainstSchema,
  type SchemaValidationResult,
} from "@/lib/components/validate-schema";

const STATE_OPTIONS = [
  { value: "output-available", label: "output-available" },
  { value: "input-streaming", label: "input-streaming" },
  { value: "input-available", label: "input-available" },
  { value: "error", label: "error" },
] as const;

function deriveBooleans(state: string) {
  return {
    isLoading: state === "input-streaming" || state === "input-available",
    isComplete: state === "output-available",
    isError: state === "error",
  };
}

interface ComponentPlaygroundProps {
  componentId: string;
  componentSource: string;
  componentKey?: string;
  allComponents?: ComponentRecord[];
  toolInputSchemaId?: string | null;
  toolOutputSchemaId?: string | null;
}

export function ComponentPlayground({
  componentId,
  componentSource,
  componentKey,
  allComponents,
  toolInputSchemaId,
  toolOutputSchemaId,
}: ComponentPlaygroundProps) {
  const [toolName, setToolName] = useState("");
  const [inputValue, setInputValue] = useState("{}");
  const [outputValue, setOutputValue] = useState("{}");
  const [state, setState] = useState("output-available");
  const [previewKey, setPreviewKey] = useState(0);

  const { testCases, mutate: mutateCases } =
    useComponentTestCases(componentId);

  // Save dialog state
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTags, setSaveTags] = useState<string[]>([]);
  const [saveTagInput, setSaveTagInput] = useState("");
  const [saveShowAsExample, setSaveShowAsExample] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputValidation, setInputValidation] =
    useState<SchemaValidationResult | null>(null);
  const [outputValidation, setOutputValidation] =
    useState<SchemaValidationResult | null>(null);

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

  const booleans = useMemo(() => deriveBooleans(state), [state]);

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

  // Compile component graph to resolve cross-component references
  const compiledComponent = useMemo(() => {
    if (!componentKey || !allComponents?.length || !componentSource.trim())
      return undefined;
    try {
      // Replace current component's source with latest (unsaved) version
      const records = allComponents.map((r) =>
        r.key === componentKey ? { ...r, source: componentSource } : r
      );
      const compiled = compileComponentGraph(records);
      return compiled.get(componentKey);
    } catch (e) {
      console.error("[playground-composition]", e);
      return undefined;
    }
  }, [componentKey, allComponents, componentSource]);

  const runSchemaValidation = useCallback(async () => {
    const [inResult, outResult] = await Promise.all([
      validateAgainstSchema(toolInputSchemaId, parsedInput),
      validateAgainstSchema(toolOutputSchemaId, parsedOutput),
    ]);
    setInputValidation(inResult);
    setOutputValidation(outResult);
  }, [toolInputSchemaId, toolOutputSchemaId, parsedInput, parsedOutput]);

  const handleRefresh = useCallback(() => {
    setPreviewKey((k) => k + 1);
    runSchemaValidation();
  }, [runSchemaValidation]);

  const handleLoadTestCase = useCallback(
    (tool: { name: string; input: unknown; output: unknown }) => {
      setToolName(tool.name);
      setInputValue(JSON.stringify(tool.input, null, 2));
      setOutputValue(JSON.stringify(tool.output, null, 2));
      setPreviewKey((k) => k + 1);
      setInputValidation(null);
      setOutputValidation(null);
    },
    []
  );

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
    let parsedIn: unknown;
    let parsedOut: unknown;
    try {
      parsedIn = JSON.parse(inputValue);
    } catch {
      toast.error("Invalid input JSON");
      return;
    }
    try {
      parsedOut = JSON.parse(outputValue);
    } catch {
      toast.error("Invalid output JSON");
      return;
    }
    setSaving(true);
    try {
      const result = await createComponentTestCase(
        componentId,
        {
          name: saveName.trim(),
          tool: { name: toolName, input: parsedIn, output: parsedOut },
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
    outputValue,
    toolName,
    saveTags,
    saveShowAsExample,
    componentId,
    mutateCases,
  ]);

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          {/* Tool */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Tool
              </label>
              {testCases.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 gap-0.5 px-1.5 text-xs text-muted-foreground"
                    >
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
                            onClick={() => handleLoadTestCase(tc.tool)}
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
                            onClick={() => handleLoadTestCase(tc.tool)}
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

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="e.g. get_weather"
              />
            </div>

            {/* Input */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Input (JSON)
              </label>
              <JsonEditor
                value={inputValue}
                onChange={setInputValue}
                height="120px"
                className="mt-1"
              />
              {inputValidation && !inputValidation.valid && (
                <div className="mt-1 space-y-0.5">
                  {inputValidation.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {e.path ? `${e.path}: ` : ""}{e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Output */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Output (JSON)
              </label>
              <JsonEditor
                value={outputValue}
                onChange={setOutputValue}
                height="120px"
                className="mt-1"
              />
              {outputValidation && !outputValidation.valid && (
                <div className="mt-1 space-y-0.5">
                  {outputValidation.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {e.path ? `${e.path}: ` : ""}{e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* State */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              State
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Badge
                  variant={booleans.isLoading ? "default" : "outline"}
                  className="px-1.5 py-0 text-[10px]"
                >
                  isLoading
                </Badge>
                <Badge
                  variant={booleans.isComplete ? "default" : "outline"}
                  className="px-1.5 py-0 text-[10px]"
                >
                  isComplete
                </Badge>
                <Badge
                  variant={booleans.isError ? "destructive" : "outline"}
                  className="px-1.5 py-0 text-[10px]"
                >
                  isError
                </Badge>
              </div>
            </div>
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
                    state={state}
                    source={compiledComponent ? undefined : componentSource}
                    compiledComponent={compiledComponent}
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

      <div className="flex items-center gap-2 border-t px-4 py-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          className="gap-1"
        >
          <RefreshCwIcon className="size-3" />
          Refresh
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
                placeholder="e.g. Basic pricing result"
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
