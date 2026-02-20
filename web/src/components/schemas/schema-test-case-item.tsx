"use client";

import { useCallback, useState } from "react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  MinusCircleIcon,
  PlayIcon,
  PlusIcon,
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { SchemaTestCaseRow } from "@/db/schema";
import type { SchemaRunTestCaseResult } from "@/lib/schemas/test-case-hooks";

export interface SchemaTestCaseItemProps {
  testCase: SchemaTestCaseRow;
  onSave: (
    caseId: string,
    data: {
      name: string;
      input: Record<string, unknown>;
      shouldPass: boolean;
      expectedErrors?: Array<{ path: string; message: string }>;
      tags: string[];
    }
  ) => Promise<void>;
  onDelete: (caseId: string) => Promise<void>;
  onRun: (
    input: Record<string, unknown>,
    shouldPass: boolean,
    expectedErrors?: Array<{ path: string; message: string }>
  ) => Promise<SchemaRunTestCaseResult>;
  busy: boolean;
}

export function SchemaTestCaseItem({
  testCase,
  onSave,
  onDelete,
  onRun,
  busy,
}: SchemaTestCaseItemProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(testCase.name);
  const [inputValue, setInputValue] = useState(
    JSON.stringify(testCase.input, null, 2)
  );
  const [shouldPass, setShouldPass] = useState(testCase.shouldPass);
  const [expectedErrors, setExpectedErrors] = useState<
    Array<{ path: string; message: string }>
  >(testCase.expectedErrors ?? []);
  const [tags, setTags] = useState<string[]>(testCase.tags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState(false);
  const [localResult, setLocalResult] = useState<SchemaRunTestCaseResult | undefined>(
    undefined
  );

  const handleSave = useCallback(async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(inputValue);
    } catch {
      return;
    }
    setSaving(true);
    try {
      await onSave(testCase.id, {
        name,
        input: parsed,
        shouldPass,
        expectedErrors: !shouldPass && expectedErrors.length > 0 ? expectedErrors : undefined,
        tags,
      });
    } finally {
      setSaving(false);
    }
  }, [testCase.id, name, inputValue, shouldPass, expectedErrors, tags, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(testCase.id);
    } finally {
      setDeleting(false);
    }
  }, [testCase.id, onDelete]);

  const handleRun = useCallback(async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(inputValue);
    } catch {
      return;
    }
    setRunning(true);
    try {
      const r = await onRun(
        parsed,
        shouldPass,
        !shouldPass && expectedErrors.length > 0 ? expectedErrors : undefined
      );
      setLocalResult(r);
    } finally {
      setRunning(false);
    }
  }, [inputValue, shouldPass, expectedErrors, onRun]);

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

  const handleAddExpectedError = useCallback(() => {
    setExpectedErrors([...expectedErrors, { path: "", message: "" }]);
  }, [expectedErrors]);

  const handleRemoveExpectedError = useCallback(
    (index: number) => {
      setExpectedErrors(expectedErrors.filter((_, i) => i !== index));
    },
    [expectedErrors]
  );

  const handleUpdateExpectedError = useCallback(
    (index: number, field: "path" | "message", value: string) => {
      setExpectedErrors(
        expectedErrors.map((err, i) =>
          i === index ? { ...err, [field]: value } : err
        )
      );
    },
    [expectedErrors]
  );

  // Status icon for header
  const statusIcon = localResult ? (
    localResult.passed ? (
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
            <span className="flex-1 truncate font-medium">{testCase.name}</span>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px]"
              >
                {testCase.shouldPass ? "Valid" : "Invalid"}
              </Badge>
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

            {/* Input JSON */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Input
              </label>
              <JsonEditor
                value={inputValue}
                onChange={setInputValue}
                height="100px"
                className="mt-1"
              />
            </div>

            {/* Should Pass */}
            <div className="flex items-center gap-2">
              <Switch
                checked={shouldPass}
                onCheckedChange={setShouldPass}
              />
              <Label className="text-xs">
                {shouldPass ? "Should be valid" : "Should be invalid"}
              </Label>
            </div>

            {/* Expected Errors (only when shouldPass=false) */}
            {!shouldPass && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Expected Errors
                </label>
                <div className="mt-1 space-y-2">
                  {expectedErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="h-7 flex-1 text-xs font-mono"
                        value={err.path}
                        onChange={(e) =>
                          handleUpdateExpectedError(i, "path", e.target.value)
                        }
                        placeholder="path (e.g. name)"
                      />
                      <Input
                        className="h-7 flex-[2] text-xs"
                        value={err.message}
                        onChange={(e) =>
                          handleUpdateExpectedError(i, "message", e.target.value)
                        }
                        placeholder="message substring"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveExpectedError(i)}
                      >
                        <MinusCircleIcon className="size-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-xs"
                    onClick={handleAddExpectedError}
                  >
                    <PlusIcon className="size-3" />
                    Add Error
                  </Button>
                </div>
              </div>
            )}

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
            {localResult && (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {localResult.passed ? (
                      <span className="text-green-600">Passed</span>
                    ) : (
                      <span className="text-destructive">Failed</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {localResult.durationMs}ms
                  </span>
                </div>
                <div className="text-xs">
                  {localResult.valid ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">
                      Invalid ({localResult.errors?.length ?? 0} errors)
                    </Badge>
                  )}
                </div>
                {localResult.errors && localResult.errors.length > 0 && (
                  <div className="space-y-1">
                    {localResult.errors.map((err, i) => (
                      <div key={i} className="rounded bg-destructive/10 px-2 py-1 text-xs">
                        <span className="font-mono text-destructive">{err.path || "(root)"}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span>{err.message}</span>
                      </div>
                    ))}
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
