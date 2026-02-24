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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataCard } from "@/components/components/data-card";
import {
  DynamicComponentRenderer,
  DynamicComponentErrorBoundary,
  type ComponentRecord,
} from "@/tool-ui";
import { useCompiledComponent } from "@/lib/components/use-compiled-component";
import {
  useComponentTestCases,
  createComponentTestCase,
} from "@/lib/components/test-case-hooks";
import type { JsonSchema7 } from "@/lib/schemas/types";
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
  toolInputSchema?: JsonSchema7 | null;
  componentInputSchema?: JsonSchema7 | null;
}

export function ComponentPlayground({
  componentId,
  componentSource,
  componentKey,
  allComponents,
  toolInputSchema,
  componentInputSchema,
}: ComponentPlaygroundProps) {
  const [dataValue, setDataValue] = useState("{}");
  const [state, setState] = useState("output-available");
  const [previewKey, setPreviewKey] = useState(0);
  const [scenario, setScenario] = useState<"tool" | "component">("tool");

  const { testCases, mutate: mutateCases } =
    useComponentTestCases(componentId);

  // Save dialog state
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveTags, setSaveTags] = useState<string[]>([]);
  const [saveTagInput, setSaveTagInput] = useState("");
  const [saveShowAsExample, setSaveShowAsExample] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dataValidation, setDataValidation] =
    useState<SchemaValidationResult | null>(null);

  const activeSchema = scenario === "tool" ? toolInputSchema : componentInputSchema;

  const parsedData = useMemo(() => {
    try {
      return JSON.parse(dataValue || "{}");
    } catch {
      return {};
    }
  }, [dataValue]);

  const booleans = useMemo(() => deriveBooleans(state), [state]);

  // Split test cases by scenario for grouped dropdown
  const { examples, nonExamples } = useMemo(() => {
    const ex: typeof testCases = [];
    const ne: typeof testCases = [];
    for (const tc of testCases) {
      if (tc.scenario !== scenario) continue;
      if (tc.showAsExample) ex.push(tc);
      else ne.push(tc);
    }
    return { examples: ex, nonExamples: ne };
  }, [testCases, scenario]);

  const { compiledComponent } = useCompiledComponent(
    componentKey,
    allComponents,
    componentSource,
  );

  const runSchemaValidation = useCallback(async () => {
    const result = await validateAgainstSchema(activeSchema, parsedData);
    setDataValidation(result);
  }, [activeSchema, parsedData]);

  const handleRefresh = useCallback(() => {
    setPreviewKey((k) => k + 1);
    runSchemaValidation();
  }, [runSchemaValidation]);

  const handleLoadTestCase = useCallback(
    (data: unknown) => {
      setDataValue(JSON.stringify(data, null, 2));
      setPreviewKey((k) => k + 1);
      setDataValidation(null);
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataValue);
    } catch {
      toast.error("Invalid data JSON");
      return;
    }
    setSaving(true);
    try {
      const result = await createComponentTestCase(
        componentId,
        {
          name: saveName.trim(),
          data: parsed,
          tags: saveTags.length > 0 ? saveTags : undefined,
          showAsExample: saveShowAsExample || undefined,
          scenario,
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
    dataValue,
    saveTags,
    saveShowAsExample,
    scenario,
    componentId,
    mutateCases,
  ]);

  const hasLoadableCases = examples.length > 0 || nonExamples.length > 0;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          {/* Scenario toggle */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Scenario
            </label>
            <Tabs
              value={scenario}
              onValueChange={(v) => setScenario(v as "tool" | "component")}
              className="mt-1"
            >
              <TabsList className="h-7">
                <TabsTrigger value="tool" className="text-xs">Tool</TabsTrigger>
                <TabsTrigger value="component" className="text-xs">Component</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Data */}
          <DataCard
            dataValue={dataValue}
            onDataChange={setDataValue}
            headerExtra={
              hasLoadableCases ? (
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
                            onClick={() => handleLoadTestCase(tc.data)}
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
                            onClick={() => handleLoadTestCase(tc.data)}
                          >
                            {tc.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : undefined
            }
            dataExtra={
              dataValidation && !dataValidation.valid ? (
                <div className="mt-1 space-y-0.5">
                  {dataValidation.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {e.path ? `${e.path}: ` : ""}{e.message}
                    </p>
                  ))}
                </div>
              ) : undefined
            }
          />

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
                  fallbackLabel="preview"
                >
                  <DynamicComponentRenderer
                    data={scenario === "component" ? parsedData : undefined}
                    tool={scenario === "tool" ? parsedData : undefined}
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
