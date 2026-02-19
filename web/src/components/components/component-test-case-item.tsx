"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  PlayIcon,
  SaveIcon,
  Trash2Icon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";
import { Spinner } from "@/components/ui/spinner";
import { DynamicToolRenderer, DynamicComponentErrorBoundary } from "@/tool-ui";
import type { ComponentTestCaseRow } from "@/db/schema";

export interface ComponentTestRunResult {
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface ComponentTestCaseItemProps {
  testCase: ComponentTestCaseRow;
  componentSource: string;
  onSave: (
    caseId: string,
    data: {
      name: string;
      tool: { name: string; input: unknown; output: unknown };
      tags: string[];
    }
  ) => Promise<void>;
  onDelete: (caseId: string) => Promise<void>;
  onRun: (
    tool: { name: string; input: unknown; output: unknown }
  ) => Promise<ComponentTestRunResult>;
  runResult?: ComponentTestRunResult;
  busy: boolean;
}

export function ComponentTestCaseItem({
  testCase,
  componentSource,
  onSave,
  onDelete,
  onRun,
  runResult,
  busy,
}: ComponentTestCaseItemProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(testCase.name);
  const [toolName, setToolName] = useState(testCase.tool.name);
  const [inputValue, setInputValue] = useState(
    JSON.stringify(testCase.tool.input, null, 2)
  );
  const [outputValue, setOutputValue] = useState(
    JSON.stringify(testCase.tool.output, null, 2)
  );
  const [tags, setTags] = useState<string[]>(testCase.tags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);
  const [localResult, setLocalResult] = useState<
    ComponentTestRunResult | undefined
  >(undefined);
  const [previewKey, setPreviewKey] = useState(0);

  const result = runResult ?? localResult;

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

  const handleSave = useCallback(async () => {
    let parsedIn: unknown;
    let parsedOut: unknown;
    try {
      parsedIn = JSON.parse(inputValue);
    } catch {
      return;
    }
    try {
      parsedOut = JSON.parse(outputValue);
    } catch {
      return;
    }
    setSaving(true);
    try {
      await onSave(testCase.id, {
        name,
        tool: { name: toolName, input: parsedIn, output: parsedOut },
        tags,
      });
    } finally {
      setSaving(false);
    }
  }, [testCase.id, name, toolName, inputValue, outputValue, tags, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(testCase.id);
    } finally {
      setDeleting(false);
    }
  }, [testCase.id, onDelete]);

  const handleRun = useCallback(async () => {
    let parsedIn: unknown;
    let parsedOut: unknown;
    try {
      parsedIn = JSON.parse(inputValue);
    } catch {
      return;
    }
    try {
      parsedOut = JSON.parse(outputValue);
    } catch {
      return;
    }
    setRunning(true);
    try {
      const r = await onRun({
        name: toolName,
        input: parsedIn,
        output: parsedOut,
      });
      setLocalResult(r);
      setPreviewKey((k) => k + 1);
    } finally {
      setRunning(false);
    }
  }, [inputValue, outputValue, toolName, onRun]);

  const handleAddTag = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setTagInput("");
    },
    [tags]
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag(tagInput);
      }
    },
    [tagInput, handleAddTag]
  );

  // Status icon for header
  const statusIcon = result ? (
    result.passed ? (
      <CheckCircle2Icon className="size-3.5 text-green-500" />
    ) : (
      <XCircleIcon className="size-3.5 text-destructive" />
    )
  ) : null;

  const itemBusy = saving || deleting || running || busy;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
          >
            <ChevronDownIcon
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
            />
            <span className="flex-1 truncate font-medium">
              {testCase.name}
            </span>
            <div className="flex items-center gap-1.5">
              {testCase.tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px]"
                >
                  {t}
                </Badge>
              ))}
              {statusIcon}
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0"
                disabled={itemBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRun();
                }}
              >
                {running ? (
                  <Spinner className="size-3" />
                ) : (
                  <PlayIcon className="size-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 text-muted-foreground hover:text-destructive"
                disabled={itemBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                {deleting ? (
                  <Spinner className="size-3" />
                ) : (
                  <Trash2Icon className="size-3" />
                )}
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 px-3 pb-3">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Tags
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() =>
                        setTags(tags.filter((t) => t !== tag))
                      }
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  className="h-6 min-w-[80px] flex-1 border-none px-1 text-xs shadow-none focus-visible:ring-0"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() =>
                    tagInput.trim() && handleAddTag(tagInput)
                  }
                  placeholder="Add tag..."
                />
              </div>
            </div>

            {/* Tool Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Tool Name
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
              />
            </div>

            {/* Tool Input JSON */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Tool Input (JSON)
              </label>
              <JsonEditor
                value={inputValue}
                onChange={setInputValue}
                height="100px"
                className="mt-1"
              />
            </div>

            {/* Tool Output JSON */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Tool Output (JSON)
              </label>
              <JsonEditor
                value={outputValue}
                onChange={setOutputValue}
                height="100px"
                className="mt-1"
              />
            </div>

            {/* Save button */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={itemBusy}
              className="gap-1"
            >
              {saving ? (
                <Spinner className="size-3" />
              ) : (
                <SaveIcon className="size-3" />
              )}
              Save
            </Button>

            {/* Run result */}
            {result && (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {result.passed ? (
                      <span className="text-green-600">Passed</span>
                    ) : (
                      <span className="text-destructive">
                        {result.error ? "Error" : "Failed"}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {result.durationMs}ms
                  </span>
                </div>
                {result.error && (
                  <p className="text-xs text-destructive whitespace-pre-wrap">
                    {result.error}
                  </p>
                )}
                {result.passed && componentSource.trim() && (
                  <div className="rounded-md border p-2">
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
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
