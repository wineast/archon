"use client";

import { useCallback, useMemo, useState, type ComponentType } from "react";
import {
  PencilIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/editors/json-editor";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  useComponentTestCases,
  updateComponentTestCase,
  deleteComponentTestCase,
} from "@/lib/components/test-case-hooks";
import {
  DynamicToolRenderer,
  DynamicComponentErrorBoundary,
  compileComponentGraph,
  type ComponentRecord,
  type ToolRendererProps,
} from "@/tool-ui";
import type { ComponentTestCaseRow } from "@/db/schema";

interface ComponentExamplesPanelProps {
  componentId: string;
  componentSource: string;
  componentKey?: string;
  allComponents?: ComponentRecord[];
}

export function ComponentExamplesPanel({
  componentId,
  componentSource,
  componentKey,
  allComponents,
}: ComponentExamplesPanelProps) {
  const { testCases, mutate: mutateCases } =
    useComponentTestCases(componentId);

  const examples = useMemo(
    () => testCases.filter((tc) => tc.showAsExample),
    [testCases]
  );

  // Compile component graph to resolve cross-component references
  const compiledComponent = useMemo(() => {
    if (!componentKey || !allComponents?.length || !componentSource.trim())
      return undefined;
    try {
      const records = allComponents.map((r) =>
        r.key === componentKey ? { ...r, source: componentSource } : r
      );
      const compiled = compileComponentGraph(records);
      return compiled.get(componentKey);
    } catch {
      return undefined;
    }
  }, [componentKey, allComponents, componentSource]);

  const handleSave = useCallback(
    async (caseId: string, data: Record<string, unknown>) => {
      await updateComponentTestCase(componentId, caseId, data, mutateCases);
    },
    [componentId, mutateCases]
  );

  const handleDelete = useCallback(
    async (caseId: string) => {
      await deleteComponentTestCase(componentId, caseId, mutateCases);
    },
    [componentId, mutateCases]
  );

  if (examples.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-center text-sm text-muted-foreground">
          No examples yet. Go to the <strong>Test Cases</strong> tab and toggle{" "}
          <strong>Show as Example</strong> on any test case to display it here.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-4 space-y-4">
        {examples.map((tc) => (
          <ExampleCard
            key={tc.id}
            testCase={tc}
            componentSource={componentSource}
            compiledComponent={compiledComponent}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// ── ExampleCard ──

interface ExampleCardProps {
  testCase: ComponentTestCaseRow;
  componentSource: string;
  compiledComponent: ComponentType<ToolRendererProps> | undefined;
  onSave: (caseId: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (caseId: string) => Promise<void>;
}

function ExampleCard({
  testCase,
  componentSource,
  compiledComponent,
  onSave,
  onDelete,
}: ExampleCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit state
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
  const [showAsExample, setShowAsExample] = useState(testCase.showAsExample);
  const [saving, setSaving] = useState(false);

  const parsedTool = useMemo(() => {
    try {
      return {
        name: toolName,
        input: JSON.parse(inputValue || "{}"),
        output: JSON.parse(outputValue || "{}"),
      };
    } catch {
      return testCase.tool;
    }
  }, [toolName, inputValue, outputValue, testCase.tool]);

  const busy = saving || deleting;

  const handleEdit = useCallback(() => {
    // Reset edit state from testCase
    setName(testCase.name);
    setToolName(testCase.tool.name);
    setInputValue(JSON.stringify(testCase.tool.input, null, 2));
    setOutputValue(JSON.stringify(testCase.tool.output, null, 2));
    setTags(testCase.tags);
    setTagInput("");
    setShowAsExample(testCase.showAsExample);
    setEditing(true);
  }, [testCase]);

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
        showAsExample,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [testCase.id, name, toolName, inputValue, outputValue, tags, showAsExample, onSave]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(testCase.id);
    } finally {
      setDeleting(false);
    }
  }, [testCase.id, onDelete]);

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

  // Use edited tool data when editing for live preview
  const displayTool = editing ? parsedTool : testCase.tool;

  return (
    <>
      <div className="rounded-lg border">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2">
          <h3 className="flex-1 truncate text-sm font-medium">
            {testCase.name}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-muted-foreground"
            disabled={busy}
            onClick={editing ? () => setEditing(false) : handleEdit}
          >
            {editing ? (
              <XIcon className="size-3.5" />
            ) : (
              <PencilIcon className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
          >
            {deleting ? (
              <Spinner className="size-3.5" />
            ) : (
              <Trash2Icon className="size-3.5" />
            )}
          </Button>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="space-y-3 border-t px-4 py-3">
            {/* Name */}
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Tags */}
            <div>
              <Label className="text-xs">Tags</Label>
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
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
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
                  onBlur={() => tagInput.trim() && handleAddTag(tagInput)}
                  placeholder="Add tag..."
                />
              </div>
            </div>

            {/* Show as Example */}
            <div className="flex items-center gap-2">
              <Switch
                id={`ex-example-${testCase.id}`}
                checked={showAsExample}
                onCheckedChange={setShowAsExample}
              />
              <Label
                htmlFor={`ex-example-${testCase.id}`}
                className="text-xs font-medium text-muted-foreground"
              >
                Show as Example
              </Label>
            </div>

            {/* Tool Name */}
            <div>
              <Label className="text-xs">Tool Name</Label>
              <Input
                className="mt-1 h-8 text-sm"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
              />
            </div>

            {/* Tool Input */}
            <div>
              <Label className="text-xs">Tool Input (JSON)</Label>
              <JsonEditor
                value={inputValue}
                onChange={setInputValue}
                height="100px"
                className="mt-1"
              />
            </div>

            {/* Tool Output */}
            <div>
              <Label className="text-xs">Tool Output (JSON)</Label>
              <JsonEditor
                value={outputValue}
                onChange={setOutputValue}
                height="100px"
                className="mt-1"
              />
            </div>

            {/* Save */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={busy}
              className="gap-1"
            >
              {saving ? (
                <Spinner className="size-3" />
              ) : (
                <SaveIcon className="size-3" />
              )}
              Save
            </Button>
          </div>
        )}

        {/* Preview */}
        <div className={editing ? "border-t p-4" : "p-4"}>
          <DynamicComponentErrorBoundary
            fallbackToolName={displayTool.name || "example"}
          >
            <DynamicToolRenderer
              tool={displayTool}
              state="output-available"
              source={compiledComponent ? undefined : componentSource}
              compiledComponent={compiledComponent}
            />
          </DynamicComponentErrorBoundary>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Example"
        description={`Are you sure you want to delete "${testCase.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </>
  );
}
